from __future__ import annotations

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_CHARTS, MOCK_DASHBOARDS, MOCK_DATASETS
from app.models.base import CamelModel

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(CamelModel):
    query: str
    types: list[str] | None = None  # ["dashboard", "chart", "dataset"]


@router.post("")
async def search(body: SearchRequest, superset: SupersetDep):
    q = body.query.lower()
    results: list[dict] = []

    # Search dashboards
    if not body.types or "dashboard" in body.types:
        for d in MOCK_DASHBOARDS:
            if q in d["title"].lower() or q in (d.get("description") or "").lower():
                results.append({"type": "dashboard", "id": d["id"], "name": d["title"]})

    # Search charts
    if not body.types or "chart" in body.types:
        charts = MOCK_CHARTS
        if superset:
            try:
                raw = await superset.list_charts()
                charts = [{"id": str(c.get("id")), "name": c.get("slice_name", "")} for c in raw]
            except Exception:
                pass
        for c in charts:
            if q in c["name"].lower():
                results.append({"type": "chart", "id": c["id"], "name": c["name"]})

    # Search datasets
    if not body.types or "dataset" in body.types:
        for ds in MOCK_DATASETS:
            if q in ds["name"].lower() or q in ds["table_name"].lower():
                results.append({"type": "dataset", "id": ds["id"], "name": ds["name"]})

    return {"query": body.query, "results": results, "total": len(results)}
