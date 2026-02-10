"""RecViz FastAPI backend — proxy + sidecar for headless Superset."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.superset_client import SupersetClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared HTTP client + Superset client
    http = httpx.AsyncClient(timeout=30.0)
    superset = SupersetClient(http)

    try:
        await superset.authenticate()
        app.state.superset = superset
        logger.info("Superset client ready")
    except Exception as e:
        logger.warning("Superset unavailable at startup: %s — running in mock mode", e)
        app.state.superset = None

    app.state.http = http

    yield

    # Shutdown
    await http.aclose()


app = FastAPI(title="RecViz API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    superset_ok = app.state.superset is not None
    return {"status": "ok", "superset": superset_ok}


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
