from __future__ import annotations

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_DASHBOARDS

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


async def _get_chart_count(superset, dashboard_id: int) -> int:
    """Get chart count for a dashboard from Superset charts API."""
    try:
        charts = await superset.list_charts()
        return sum(
            1 for c in charts
            if any(
                d.get("id") == dashboard_id
                for d in (c.get("dashboards") or [])
            )
        )
    except Exception:
        return 0


def _format_dashboard(d: dict, chart_count: int = 0) -> dict:
    return {
        "id": str(d.get("id")),
        "title": d.get("dashboard_title", ""),
        "slug": d.get("slug", ""),
        "description": d.get("description"),
        "status": "active" if d.get("published", True) else "draft",
        "chart_count": chart_count,
        "changed_on": d.get("changed_on_delta_humanized", d.get("changed_on", "")),
    }


@router.get("")
async def list_dashboards(superset: SupersetDep):
    if superset:
        try:
            raw = await superset.list_dashboards()

            # Get all charts to count per dashboard
            try:
                all_charts = await superset.list_charts()
            except Exception:
                all_charts = []

            results = []
            for d in raw:
                did = d.get("id")
                count = sum(
                    1 for c in all_charts
                    if any(
                        db.get("id") == did
                        for db in (c.get("dashboards") or [])
                    )
                )
                results.append(_format_dashboard(d, count))
            return results
        except Exception:
            pass
    return MOCK_DASHBOARDS


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str, superset: SupersetDep):
    if superset:
        try:
            raw = await superset.get_dashboard(int(dashboard_id))
            count = await _get_chart_count(superset, int(dashboard_id))
            return _format_dashboard(raw, count)
        except Exception:
            pass
    for d in MOCK_DASHBOARDS:
        if d["id"] == dashboard_id or d["slug"] == dashboard_id:
            return d
    return MOCK_DASHBOARDS[0]
