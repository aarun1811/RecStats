"""Aggregate all API routers."""

from fastapi import APIRouter

from app.api.managed_charts import router as managed_charts_router
from app.api.managed_kpis import router as managed_kpis_router
from app.api.managed_dashboards import router as managed_dashboards_router
from app.api.data_sources import router as data_sources_router
from app.api.databases import router as databases_router
from app.api.managed_datasets import router as managed_datasets_router
from app.api.search import router as search_router
from app.api.sql import router as sql_router
from app.api.views import router as views_router

api_router = APIRouter()

api_router.include_router(managed_dashboards_router)
api_router.include_router(data_sources_router)
api_router.include_router(databases_router)
api_router.include_router(managed_kpis_router)
api_router.include_router(managed_charts_router)
api_router.include_router(managed_datasets_router)
api_router.include_router(sql_router)
api_router.include_router(search_router)
api_router.include_router(views_router)
