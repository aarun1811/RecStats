"""RecViz API — Oracle-only, thick mode enforced."""

from __future__ import annotations

# --------------------------------------------------------------------------- #
# CRITICAL: Oracle thick mode init — MUST happen before ANY `from app.*`
# imports. Transitive imports (e.g., app.db.engine -> SQLAlchemy -> oracledb)
# could trigger thin-mode lock if oracledb is imported before
# init_oracle_client runs. Only stdlib (os, logging) and oracledb itself
# are safe to import before this block.
#
# Addresses review concern: HIGH — initialization order prevents transitive
# thin-mode lock via early oracledb import.
# --------------------------------------------------------------------------- #
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import oracledb

_lib_dir = os.environ.get("ORACLE_CLIENT_LIB_DIR", "").strip()
if not _lib_dir:
    raise RuntimeError(
        "FATAL: ORACLE_CLIENT_LIB_DIR is not set. "
        "Set it to the Oracle Instant Client directory "
        "(e.g. ~/oracle/instantclient on macOS, /opt/oraclient/19.3_64/lib/ on RHEL)."
    )

oracledb.init_oracle_client(lib_dir=_lib_dir)
logger.info(
    "oracledb %s thick mode initialized (Instant Client at %s)",
    oracledb.__version__,
    _lib_dir,
)

# --------------------------------------------------------------------------- #
# Safe to import app modules now — thick mode is locked in.
# --------------------------------------------------------------------------- #
import concurrent.futures
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text as sa_text, update
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.api.router import api_router
from app.config import settings
from app.db.engine import engine, session_factory
from app.db.models.connection import RecvizConnection
from app.middleware.framing import frame_headers_for_path
from app.services.connection_resolver import ConnectionResolver
from app.services.connection_status import ConnectionStatusTracker
from app.services.encryption import EncryptionService
from app.services.engine_manager import EngineManager
from app.services.query_engine import QueryExecutor
from app.services.uri_builder import build_sync_uri


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan.

    Must be declared ``async`` because FastAPI requires it, but the body is
    all sync — startup is one-time work and blocking the event loop during
    it is fine. Once startup completes, FastAPI serves requests in its
    threadpool via ``def`` handlers (see ``app/db/engine.py`` rationale).
    """
    # Thick mode startup assertion (INFRA-12, D-08)
    # Addresses review suggestion: explicit v$session_connect_info access check
    with engine.connect() as conn:
        result = conn.execute(
            sa_text(
                "SELECT client_driver FROM v$session_connect_info "
                "WHERE sid = SYS_CONTEXT('USERENV', 'SID') "
                "AND ROWNUM = 1"
            )
        )
        row = result.fetchone()
        if row is None or "thn" in str(row[0]):
            driver_info = row[0] if row else "unknown"
            raise RuntimeError(
                f"FATAL: Oracle thick mode not detected. "
                f"client_driver={driver_info}. "
                "Ensure ORACLE_CLIENT_LIB_DIR is set and Oracle Instant Client is installed. "
                "If querying v$session_connect_info fails, ensure the app user has: "
                "GRANT SELECT ON v_$session_connect_info TO recviz;"
            )
        logger.info("Oracle client driver: %s", row[0])

    # 1. Create connection status tracker (in-memory, resets on restart)
    status_tracker = ConnectionStatusTracker()
    app.state.connection_status = status_tracker
    logger.info("ConnectionStatusTracker initialized")

    # 2. Initialize EncryptionService and EngineManager
    encryption = EncryptionService(settings.recviz_encryption_key.get_secret_value())
    engine_manager = EngineManager(encryption=encryption)
    app.state.engine_manager = engine_manager
    app.state.encryption = encryption
    logger.info("EngineManager initialized")

    # 3. Pre-warm engine pool for all registered connections
    with session_factory() as session:
        result = session.execute(select(RecvizConnection))
        connections = result.scalars().all()
        for conn in connections:
            try:
                engine_manager.get_engine_for_connection(conn)
                logger.info("Pre-warmed engine for connection: %s", conn.name)
            except Exception as exc:
                logger.warning("Failed to pre-warm connection %s: %s", conn.name, exc)

    # 3b. Startup health-check sweep — persist per-connection status
    logger.info("Running startup health-check sweep...")
    sweep_start = datetime.now(timezone.utc)

    # Reload connection rows in a fresh session
    with session_factory() as session:
        result = session.execute(select(RecvizConnection))
        conn_rows = result.scalars().all()
        # Snapshot the fields we need — the session closes before check_one runs
        conn_snapshots = [
            {
                "id": c.id,
                "name": c.name,
                "backend": c.backend,
                "host": c.host,
                "port": c.port,
                "database_name": c.database_name,
                "username": c.username,
                "encrypted_password": c.encrypted_password,
            }
            for c in conn_rows
        ]

    def check_one(snapshot: dict) -> tuple[str, bool, str]:
        try:
            password = encryption.decrypt(snapshot["encrypted_password"])
            uri = build_sync_uri(
                backend=snapshot["backend"],
                host=snapshot["host"],
                port=snapshot["port"],
                database=snapshot["database_name"],
                username=snapshot["username"],
                password=password,
            )
            success, msg = EngineManager.test_connection(uri, snapshot["backend"], timeout=10)
            return (snapshot["id"], success, msg)
        except Exception as exc:
            return (snapshot["id"], False, str(exc))

    if conn_snapshots:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            sweep_results = list(pool.map(check_one, conn_snapshots))

        with session_factory() as session:
            now = datetime.now(timezone.utc)
            for conn_id, success, msg in sweep_results:
                session.execute(
                    update(RecvizConnection)
                    .where(RecvizConnection.id == conn_id)
                    .values(
                        status="connected" if success else "unreachable",
                        last_tested_at=now,
                    )
                )
                if not success:
                    logger.warning("Startup health check for %s: %s", conn_id, msg)
            session.commit()

        duration = (datetime.now(timezone.utc) - sweep_start).total_seconds()
        connected_count = sum(1 for _, ok, _ in sweep_results if ok)
        unreachable_count = len(sweep_results) - connected_count
        logger.info(
            "Startup sweep done in %.1fs: %d connected, %d unreachable",
            duration,
            connected_count,
            unreachable_count,
        )
    else:
        logger.info("Startup sweep: no registered connections to check")

    # 4. Create ConnectionResolver and sync from DB
    connection_resolver = ConnectionResolver()
    with session_factory() as session:
        connection_resolver.sync(session)
    app.state.connection_resolver = connection_resolver
    logger.info("ConnectionResolver synced (%d connections)", len(connection_resolver._cache))

    # 5. Create QueryExecutor (direct database execution)
    app.state.query_engine = QueryExecutor(
        engine_manager=engine_manager,
        connection_resolver=connection_resolver,
        status_tracker=status_tracker,
    )
    logger.info("QueryExecutor initialized -- direct database execution ready")

    yield

    # Shutdown: dispose data source engines, then metadata engine (both sync now)
    engine_manager.dispose_all()
    logger.info("All data source engines disposed")
    engine.dispose()


app = FastAPI(title="RecViz API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class XFrameOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        ancestors = [o.strip() for o in settings.recviz_embed_frame_ancestors.split(",") if o.strip()]
        for key, value in frame_headers_for_path(request.url.path, ancestors).items():
            response.headers[key] = value
        return response


class NoCacheHtmlMiddleware(BaseHTTPMiddleware):
    """Force HTML responses to never be cached by the browser.

    Vite produces content-hashed bundle filenames (``/assets/index-<hash>.js``)
    that the served ``index.html`` references. On redeploy, the hash changes
    but a cached ``index.html`` still points at the previous bundle URL --
    the browser then 404s on the missing asset and renders blank until a hard
    refresh. By asserting ``no-cache`` on every ``text/html`` response we make
    HTML always revalidate, while leaving the (already content-hashed and
    long-lived) bundle assets and JSON API responses untouched.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        content_type = response.headers.get("content-type", "")
        if content_type.lower().startswith("text/html"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        return response


app.add_middleware(XFrameOptionsMiddleware)
app.add_middleware(NoCacheHtmlMiddleware)

app.include_router(api_router)


# Direct routes MUST be registered BEFORE the StaticFiles mount below,
# otherwise the mount catches every path under / and the direct routes
# become unreachable.
@app.get("/health")
def health():
    return {"status": "healthy", "driver": "python-oracledb", "mode": "thick"}


# --------------------------------------------------------------------------- #
# Static SPA serving -- production only (no nginx available on RHEL deploy)
# --------------------------------------------------------------------------- #
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if FRONTEND_DIST.exists():
    logger.info("Frontend dist/ found at %s -- mounting SPA", FRONTEND_DIST)

    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc):
        # /api/* 404s stay as JSON 404s (do NOT fall through to index.html)
        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        # Everything else serves index.html so TanStack Router handles it
        return FileResponse(FRONTEND_DIST / "index.html")

    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")
else:
    logger.info("Frontend dist/ NOT found -- SPA serving disabled (dev mode)")
