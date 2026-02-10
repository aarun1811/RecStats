from __future__ import annotations

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_DASHBOARDS

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


@router.get("")
async def list_dashboards(superset: SupersetDep):
    if superset:
        try:
            raw = await superset.list_dashboards()
            return [
                {
                    "id": str(d.get("id")),
                    "title": d.get("dashboard_title", ""),
                    "slug": d.get("slug", ""),
                    "description": d.get("description"),
                }
                for d in raw
            ]
        except Exception:
            pass
    return MOCK_DASHBOARDS


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str, superset: SupersetDep):
    if superset:
        try:
            raw = await superset.get_dashboard(int(dashboard_id))
            return {
                "id": str(raw.get("id")),
                "title": raw.get("dashboard_title", ""),
                "slug": raw.get("slug", ""),
                "description": raw.get("description"),
            }
        except Exception:
            pass
    for d in MOCK_DASHBOARDS:
        if d["id"] == dashboard_id or d["slug"] == dashboard_id:
            return d
    return MOCK_DASHBOARDS[0]
