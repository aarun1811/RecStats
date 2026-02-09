from fastapi import APIRouter

from app.api import charts, custom, dashboards, datasets, export, search, sql, views

api_router = APIRouter()

api_router.include_router(charts.router, prefix="/charts", tags=["charts"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(sql.router, prefix="/sql", tags=["sql"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["dashboards"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(custom.router, prefix="/custom", tags=["custom"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(views.router, prefix="/views", tags=["views"])
