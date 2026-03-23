"""RecViz FastAPI backend — proxy + sidecar for headless Superset."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.api.router import api_router
from app.config import settings
from app.services.config_store import ConfigStore
from app.services.query_engine import QueryEngine
from app.services.database_registrar import DatabaseRegistrar
from app.services.superset_client import SupersetClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared HTTP client + Superset client
    http = httpx.AsyncClient(timeout=30.0)
    superset = SupersetClient(http)

    # 1. Authenticate to Superset (hard requirement)
    await superset.authenticate()
    app.state.superset = superset
    logger.info("Superset client ready")

    app.state.http = http

    # 2. Load configs
    config_store = ConfigStore()
    app.state.config_store = config_store

    # 3. Sync databases into Superset
    registrar = DatabaseRegistrar(
        superset_client=superset,
        config_path=settings.databases_config_path,
    )
    await registrar.sync()
    app.state.database_registrar = registrar
    logger.info("DatabaseRegistrar synced")

    # 4. Create QueryEngine
    app.state.query_engine = QueryEngine(
        config_store=config_store,
        superset_client=superset,
        database_registrar=registrar,
    )
    logger.info("QueryEngine initialized — ready to serve")

    yield

    # Shutdown
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
        # Allow framing from any origin (internal tool, no auth)
        response.headers["X-Frame-Options"] = "ALLOWALL"
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
