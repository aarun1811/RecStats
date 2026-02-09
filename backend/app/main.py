"""RecViz Backend — FastAPI application entry point."""

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.core.exceptions import (
    SidecarError,
    SupersetError,
    sidecar_error_handler,
    superset_error_handler,
)
from app.services.cache import CacheService
from app.services.elasticsearch import ElasticsearchService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared HTTP client for Superset
    app.state.superset_http = httpx.AsyncClient(
        base_url=settings.superset_url,
        timeout=30.0,
    )
    # Startup: Elasticsearch service
    app.state.elasticsearch = ElasticsearchService(settings.elasticsearch_url)
    # Startup: Redis cache service
    app.state.cache = CacheService(settings.redis_url)
    yield
    # Shutdown: close all connections
    await app.state.cache.close()
    await app.state.elasticsearch.close()
    await app.state.superset_http.aclose()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(SupersetError, superset_error_handler)
app.add_exception_handler(SidecarError, sidecar_error_handler)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
