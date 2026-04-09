"""RecViz FastAPI backend — proxy + sidecar for headless Superset."""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.api.router import api_router
from app.config import settings
from app.db.engine import async_session_factory, engine
from app.db.models.connection import RecvizConnection
from app.services.connection_resolver import ConnectionResolver
from app.services.connection_status import ConnectionStatusTracker
from app.services.database_registrar import DatabaseRegistrar
from app.services.encryption import EncryptionService
from app.services.engine_manager import EngineManager
from app.services.query_engine import QueryEngine, QueryExecutor
from app.services.superset_client import SupersetClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _migrate_json_connections(
    session_factory,
    config_path: str,
    encryption: EncryptionService,
) -> int:
    """Migrate databases.json entries to recviz_connections table.

    Idempotent: skips entries where name already exists.
    Returns count of newly inserted connections.
    """
    path = Path(config_path)
    if not path.exists():
        logger.info("No databases.json found at %s, skipping migration", config_path)
        return 0

    data = json.loads(path.read_text())
    databases = data.get("databases", [])
    if not databases:
        return 0

    count = 0
    async with session_factory() as session:
        for db_entry in databases:
            # Check if already migrated
            result = await session.execute(
                select(RecvizConnection).where(RecvizConnection.name == db_entry["name"])
            )
            if result.scalar_one_or_none() is not None:
                continue

            # Parse URI into fields
            uri = db_entry["sqlalchemy_uri"]
            parsed = urlparse(uri)

            connection = RecvizConnection(
                id=str(uuid.uuid4()),
                name=db_entry["name"],
                display_name=db_entry.get("display_name", db_entry["name"]),
                backend=db_entry.get("dialect", "postgresql"),
                host=parsed.hostname or "localhost",
                port=parsed.port or 5432,
                database_name=_extract_database(parsed, db_entry.get("dialect", "postgresql")),
                username=parsed.username or "",
                encrypted_password=encryption.encrypt(parsed.password or ""),
                schema_name=db_entry.get("schema", db_entry.get("schema_name", "")),
                extra_params={"type": db_entry.get("type", "")} if db_entry.get("type") else None,
            )
            session.add(connection)
            count += 1
            logger.info("Migrated connection: %s", db_entry["name"])

        await session.commit()

    return count


def _extract_database(parsed, dialect: str) -> str:
    """Extract database name from parsed URI."""
    if dialect == "oracle":
        # Oracle uses ?service_name=X query param
        params = parse_qs(parsed.query)
        return params.get("service_name", ["ORCL"])[0]
    # PostgreSQL uses /dbname path
    return parsed.path.lstrip("/") if parsed.path else "postgres"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared HTTP client + Superset client
    http = httpx.AsyncClient(timeout=120.0)
    superset = SupersetClient(http)

    # 1. Authenticate to Superset (optional -- new endpoints use QueryExecutor directly)
    try:
        await superset.authenticate()
        app.state.superset = superset
        logger.info("Superset client ready")
    except Exception as exc:
        logger.warning("Superset unavailable, running without legacy engine: %s", exc)
        app.state.superset = None

    app.state.http = http

    # 2. Sync databases into Superset (skip if Superset unavailable)
    registrar = None
    if app.state.superset is not None:
        registrar = DatabaseRegistrar(
            superset_client=superset,
            config_path=settings.databases_config_path,
        )
        await registrar.sync()
        app.state.database_registrar = registrar
        logger.info("DatabaseRegistrar synced")
    else:
        app.state.database_registrar = None
        logger.info("DatabaseRegistrar skipped (Superset unavailable)")

    # 3. Create connection status tracker (in-memory, resets on restart)
    status_tracker = ConnectionStatusTracker()
    app.state.connection_status = status_tracker
    logger.info("ConnectionStatusTracker initialized")

    # 4. Create legacy QueryEngine (skip if Superset unavailable;
    #    overwritten by QueryExecutor in step 9 regardless)
    if app.state.superset is not None and registrar is not None:
        app.state.query_engine = QueryEngine(
            superset_client=superset,
            database_registrar=registrar,
            status_tracker=status_tracker,
        )
        logger.info("QueryEngine initialized (legacy, will be replaced by QueryExecutor)")
    else:
        app.state.query_engine = None
        logger.info("QueryEngine skipped (Superset unavailable)")

    # 5. Initialize EncryptionService and EngineManager (Phase 12 -- engine foundation)
    encryption = EncryptionService(settings.recviz_encryption_key.get_secret_value())
    engine_manager = EngineManager(encryption=encryption)
    app.state.engine_manager = engine_manager
    app.state.encryption = encryption
    logger.info("EngineManager initialized")

    # 6. Auto-migrate databases.json to recviz_connections table (D-02)
    migrated_count = await _migrate_json_connections(
        session_factory=async_session_factory,
        config_path=settings.databases_config_path,
        encryption=encryption,
    )
    if migrated_count > 0:
        logger.info("Migrated %d connections from databases.json", migrated_count)

    # 7. Pre-warm engine pool for all registered connections (D-08)
    async with async_session_factory() as session:
        result = await session.execute(select(RecvizConnection))
        connections = result.scalars().all()
        for conn in connections:
            try:
                await engine_manager.get_engine_for_connection(conn)
                logger.info("Pre-warmed engine for connection: %s", conn.name)
            except Exception as exc:
                logger.warning("Failed to pre-warm connection %s: %s", conn.name, exc)

    # 8. Create ConnectionResolver and sync from DB (Phase 13 -- query execution)
    connection_resolver = ConnectionResolver()
    async with async_session_factory() as session:
        await connection_resolver.sync(session)
    app.state.connection_resolver = connection_resolver
    logger.info("ConnectionResolver synced (%d connections)", len(connection_resolver._cache))

    # 9. Create QueryExecutor (replaces Superset-backed QueryEngine)
    # Overwrites the old QueryEngine from step 4 -- all data source queries
    # now execute directly against the database via EngineManager.
    app.state.query_engine = QueryExecutor(
        engine_manager=engine_manager,
        connection_resolver=connection_resolver,
        status_tracker=status_tracker,
    )
    logger.info("QueryExecutor initialized -- direct database execution ready")

    yield

    # Shutdown: dispose data source engines, then metadata engine, then HTTP client
    await engine_manager.dispose_all()
    logger.info("All data source engines disposed")
    await engine.dispose()
    await http.aclose()


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


@app.get("/health")
async def health():
    return {"status": "ok", "superset": True}


@app.get("/api/test-superset")
async def test_superset():
    client: SupersetClient | None = app.state.superset
    if not client:
        return {"connected": False, "error": "Superset client not initialized"}
    try:
        datasets = await client.list_datasets()
        return {
            "connected": True,
            "datasets": len(datasets),
            "dataset_names": [ds.get("table_name") for ds in datasets],
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}
