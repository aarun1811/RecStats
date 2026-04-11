"""RecViz analytics backend."""

from __future__ import annotations

# --------------------------------------------------------------------------- #
# CRITICAL: Oracle thick mode init MUST happen before any `from app.*` import
# that might transitively load oracledb or create engines. Thick mode is
# required for Oracle databases using national character sets not supported by
# thin mode (e.g. NCS 871). Instant Client at /opt/oraclient/19.3_64/lib/ is
# pre-installed by infra.
# --------------------------------------------------------------------------- #
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import oracledb

try:
    oracledb.init_oracle_client(lib_dir="/opt/oraclient/19.3_64/lib")
    logger.info(
        "oracledb %s thick mode initialized (Instant Client at /opt/oraclient/19.3_64/lib)",
        oracledb.__version__,
    )
except Exception as e:
    logger.warning(
        "oracledb thick mode init failed (%s) -- falling back to thin mode", e
    )

# --------------------------------------------------------------------------- #
# Remaining imports -- now safe to load app modules
# --------------------------------------------------------------------------- #
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.api.router import api_router
from app.config import settings
from app.db.engine import engine, session_factory
from app.db.models.connection import RecvizConnection
from app.services.connection_resolver import ConnectionResolver
from app.services.connection_status import ConnectionStatusTracker
from app.services.encryption import EncryptionService
from app.services.engine_manager import EngineManager
from app.services.query_engine import QueryExecutor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan.

    Must be declared ``async`` because FastAPI requires it, but the body is
    all sync — startup is one-time work and blocking the event loop during
    it is fine. Once startup completes, FastAPI serves requests in its
    threadpool via ``def`` handlers (see ``app/db/engine.py`` rationale).
    """
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
        # Restrict framing to same origin (internal tool)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        return response


app.add_middleware(XFrameOptionsMiddleware)

app.include_router(api_router)


# Direct routes MUST be registered BEFORE the StaticFiles mount below,
# otherwise the mount catches every path under / and the direct routes
# become unreachable.
@app.get("/health")
async def health():
    return {"status": "ok"}


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
