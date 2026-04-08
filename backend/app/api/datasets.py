from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from app.core.dependencies import SupersetDep
from app.core.errors import sanitize_detail
from app.models.filters import GlobalFilters

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("")
async def list_datasets(superset: SupersetDep):
    if not superset:
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is not connected", "detail": None, "retry_after": 30},
        )
    try:
        raw = await superset.list_datasets()
        return [
            {
                "id": ds.get("id"),
                "name": ds.get("table_name", ""),
                "table_name": ds.get("table_name", ""),
                "database_id": ds.get("database", {}).get("id") if isinstance(ds.get("database"), dict) else ds.get("database_id"),
                "columns": [
                    {
                        "name": c.get("column_name", ""),
                        "type": c.get("type", "VARCHAR"),
                        "is_dimension": c.get("groupby", True),
                        "is_metric": c.get("is_dttm", False),
                        "filterable": c.get("filterable", True),
                    }
                    for c in ds.get("columns", [])
                ],
                "row_count": ds.get("row_count"),
            }
            for ds in raw
        ]
    except httpx.ConnectError as e:
        logger.warning("Superset connection failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "detail": sanitize_detail(e), "retry_after": 15},
        )
    except httpx.TimeoutException as e:
        logger.warning("Superset query timed out: %s", e)
        raise HTTPException(
            status_code=504,
            detail={"error": "query_timeout", "message": "Query timed out", "detail": sanitize_detail(e)},
        )
    except httpx.HTTPStatusError as e:
        logger.error("Superset returned error %s: %s", e.response.status_code, e)
        raise HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}", "detail": sanitize_detail(e)},
        )
    except Exception as e:
        logger.exception("Unexpected error listing datasets")
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "An unexpected error occurred", "detail": sanitize_detail(e)},
        )


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: int, superset: SupersetDep):
    if not superset:
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is not connected", "detail": None, "retry_after": 30},
        )
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
    except httpx.ConnectError as e:
        logger.warning("Superset connection failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "detail": sanitize_detail(e), "retry_after": 15},
        )
    except httpx.TimeoutException as e:
        logger.warning("Superset query timed out: %s", e)
        raise HTTPException(
            status_code=504,
            detail={"error": "query_timeout", "message": "Query timed out", "detail": sanitize_detail(e)},
        )
    except httpx.HTTPStatusError as e:
        logger.error("Superset returned error %s: %s", e.response.status_code, e)
        raise HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}", "detail": sanitize_detail(e)},
        )
    except Exception as e:
        logger.exception("Unexpected error fetching dataset %s", dataset_id)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "An unexpected error occurred", "detail": sanitize_detail(e)},
        )


# All columns to fetch for each dataset (raw row data)
DATASET_COLUMNS: dict[int, list[str]] = {
    5: [
        "id", "transaction_id", "reason", "category", "break_type",
        "amount", "currency", "region", "country", "lob", "desk",
        "status", "aging_days", "aging_bucket", "sla_breach",
        "assigned_to", "priority", "created_date", "resolved_date", "notes",
    ],
}


def _build_adhoc_filters(filters: GlobalFilters | None, dataset_id: int) -> list[dict]:
    """Convert GlobalFilters to Superset adhoc_filters for row queries."""
    if not filters:
        return []
    adhoc: list[dict] = []
    for col, vals in [
        ("status", filters.status), ("desk", filters.desk),
        ("region", filters.region), ("lob", filters.lob),
        ("currency", filters.currency), ("country", filters.country),
    ]:
        if vals:
            adhoc.append({
                "expressionType": "SIMPLE", "clause": "WHERE",
                "subject": col, "operator": "IN", "comparator": vals,
            })
    date_col = "created_date" if dataset_id == 5 else "trade_date"
    if filters.date_from:
        adhoc.append({
            "expressionType": "SIMPLE", "clause": "WHERE",
            "subject": date_col, "operator": ">=", "comparator": filters.date_from,
        })
    if filters.date_to:
        adhoc.append({
            "expressionType": "SIMPLE", "clause": "WHERE",
            "subject": date_col, "operator": "<=", "comparator": filters.date_to,
        })
    return adhoc


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
    columns = DATASET_COLUMNS.get(dataset_id)

    if not superset:
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is not connected", "detail": None, "retry_after": 30},
        )
    if not columns:
        raise HTTPException(
            status_code=404,
            detail={"error": "dataset_not_found", "message": f"No column definition for dataset: {dataset_id}", "detail": None},
        )

    try:
        query: dict[str, Any] = {
            "columns": columns,
            "row_limit": page_size,
            "row_offset": (page - 1) * page_size,
        }

        adhoc = _build_adhoc_filters(filters, dataset_id)
        if adhoc:
            query["filters"] = adhoc

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
    except httpx.ConnectError as e:
        logger.warning("Superset connection failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "detail": sanitize_detail(e), "retry_after": 15},
        )
    except httpx.TimeoutException as e:
        logger.warning("Superset query timed out: %s", e)
        raise HTTPException(
            status_code=504,
            detail={"error": "query_timeout", "message": "Query timed out", "detail": sanitize_detail(e)},
        )
    except httpx.HTTPStatusError as e:
        logger.error("Superset returned error %s: %s", e.response.status_code, e)
        raise HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}", "detail": sanitize_detail(e)},
        )
    except Exception as e:
        logger.exception("Unexpected error fetching dataset data for %s", dataset_id)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "An unexpected error occurred", "detail": sanitize_detail(e)},
        )
