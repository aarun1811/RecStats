from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException

from app.core.dependencies import ConfigStoreDep, SupersetDep
from app.core.errors import sanitize_detail
from app.models.base import CamelModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(CamelModel):
    query: str
    types: list[str] | None = None  # ["dashboard", "chart", "dataset"]


@router.post("")
async def search(body: SearchRequest, superset: SupersetDep, config_store: ConfigStoreDep):
    q = body.query.lower()
    results: list[dict] = []

    # Search dashboards from config store (always available)
    if not body.types or "dashboard" in body.types:
        for d in config_store.list_dashboards():
            if q in d.name.lower() or q in (d.description or "").lower():
                results.append({"type": "dashboard", "id": d.id, "name": d.name})

    # Search charts via Superset
    if not body.types or "chart" in body.types:
        if not superset:
            logger.warning("Superset unavailable for chart search")
        else:
            try:
                raw = await superset.list_charts()
                charts = [{"id": str(c.get("id")), "name": c.get("slice_name", "")} for c in raw]
                for c in charts:
                    if q in c["name"].lower():
                        results.append({"type": "chart", "id": c["id"], "name": c["name"]})
            except httpx.ConnectError as e:
                logger.warning("Superset connection failed during search: %s", e)
            except httpx.TimeoutException as e:
                logger.warning("Superset timed out during search: %s", e)
            except httpx.HTTPStatusError as e:
                logger.error("Superset error during search: %s", e)
            except Exception as e:
                logger.exception("Unexpected error during chart search")

    # Search datasets via Superset
    if not body.types or "dataset" in body.types:
        if not superset:
            logger.warning("Superset unavailable for dataset search")
        else:
            try:
                raw = await superset.list_datasets()
                for ds in raw:
                    name = ds.get("table_name", "")
                    if q in name.lower():
                        results.append({"type": "dataset", "id": ds.get("id"), "name": name})
            except httpx.ConnectError as e:
                logger.warning("Superset connection failed during dataset search: %s", e)
            except httpx.TimeoutException as e:
                logger.warning("Superset timed out during dataset search: %s", e)
            except httpx.HTTPStatusError as e:
                logger.error("Superset error during dataset search: %s", e)
            except Exception as e:
                logger.exception("Unexpected error during dataset search")

    return {"query": body.query, "results": results, "total": len(results)}
