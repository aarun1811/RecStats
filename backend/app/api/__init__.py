# API routes module
from fastapi import APIRouter

from app.api import datasources, queries, charts, dashboards, upload, health, data, collections, search, filters

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(datasources.router, prefix="/datasources", tags=["datasources"])
api_router.include_router(queries.router, prefix="/queries", tags=["queries"])
api_router.include_router(charts.router, prefix="/charts", tags=["charts"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["dashboards"])
api_router.include_router(collections.router, prefix="/collections", tags=["collections"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(data.router, tags=["data"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(filters.router, tags=["filters"])
