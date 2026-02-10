from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_DATASETS
from app.models.filters import GlobalFilters

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("")
async def list_datasets(superset: SupersetDep):
    if superset:
        try:
            raw = await superset.list_datasets()
            return [
                {
                    "id": ds.get("id"),
                    "name": ds.get("table_name", ""),
                    "table_name": ds.get("table_name", ""),
                    "database_id": ds.get("database", {}).get("id") if isinstance(ds.get("database"), dict) else ds.get("database_id"),
                }
                for ds in raw
            ]
        except Exception:
            pass
    return MOCK_DATASETS


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: int, superset: SupersetDep):
    if superset:
        try:
            raw = await superset.get_dataset(dataset_id)
            columns = [
                {
                    "name": c.get("column_name", ""),
                    "type": c.get("type", "VARCHAR"),
                    "is_dimension": c.get("groupby", True),
                    "is_metric": c.get("is_dttm", False),
                    "filterable": c.get("filterable", True),
                }
                for c in raw.get("columns", [])
            ]
            return {
                "id": raw.get("id"),
                "name": raw.get("table_name", ""),
                "table_name": raw.get("table_name", ""),
                "database_id": raw.get("database", {}).get("id") if isinstance(raw.get("database"), dict) else None,
                "columns": columns,
            }
        except Exception:
            pass
    for ds in MOCK_DATASETS:
        if ds["id"] == dataset_id:
            return ds
    return {"error": "dataset not found"}


@router.post("/{dataset_id}/data")
async def get_dataset_data(
    dataset_id: int,
    superset: SupersetDep,
    filters: GlobalFilters | None = None,
    page: int = 1,
    page_size: int = 100,
    sort_by: str | None = None,
    sort_desc: bool = False,
):
    if superset:
        try:
            query: dict[str, Any] = {
                "columns": ["*"],
                "row_limit": page_size,
                "row_offset": (page - 1) * page_size,
            }

            if sort_by:
                query["orderby"] = [[sort_by, not sort_desc]]

            result = await superset.get_chart_data(dataset_id, [query])
            chart_result = result.get("result", [{}])[0]
            return {
                "data": chart_result.get("data", []),
                "row_count": chart_result.get("rowcount", 0),
                "page": page,
                "page_size": page_size,
            }
        except Exception:
            pass

    return {"data": [], "row_count": 0, "page": page, "page_size": page_size}
