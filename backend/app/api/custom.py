from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from app.core.dependencies import SupersetDep
from app.core.errors import sanitize_detail
from app.models.filters import GlobalFilters

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/custom", tags=["custom"])


def _build_superset_filters(
    filters: GlobalFilters | None,
    dataset: str = "breaks",
) -> list[dict[str, Any]]:
    """Convert GlobalFilters to Superset chart data API filter format.

    Args:
        filters: The global filters from the frontend.
        dataset: Which dataset the query targets. Column availability differs:
            - "breaks": status, desk, lob, region, country, currency, created_date
            - "transactions": all of the above + counterparty
    """
    if not filters:
        return []
    result: list[dict[str, Any]] = []

    # Columns available on both breaks and transactions
    common_cols = [
        ("status", "status"),
        ("desk", "desk"),
        ("lob", "lob"),
        ("region", "region"),
        ("country", "country"),
        ("currency", "currency"),
    ]
    # counterparty only exists on the transactions table
    if dataset == "transactions":
        common_cols.append(("counterparty", "counterparty"))

    for field, col in common_cols:
        values = getattr(filters, field, None)
        if values:
            result.append({"col": col, "op": "IN", "val": values})
    if filters.date_from:
        date_col = "created_date" if dataset == "breaks" else "trade_date"
        result.append({"col": date_col, "op": ">=", "val": filters.date_from})
    if filters.date_to:
        date_col = "created_date" if dataset == "breaks" else "trade_date"
        result.append({"col": date_col, "op": "<=", "val": filters.date_to})
    return result


def _superset_unavailable() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={"error": "superset_unavailable", "message": "Query engine is not connected", "detail": None, "retry_after": 30},
    )


def _handle_httpx_error(e: Exception, context: str) -> HTTPException:
    """Map httpx exceptions to appropriate HTTPExceptions."""
    if isinstance(e, httpx.ConnectError):
        logger.warning("Superset connection failed (%s): %s", context, e)
        return HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "detail": sanitize_detail(e), "retry_after": 15},
        )
    if isinstance(e, httpx.TimeoutException):
        logger.warning("Superset timed out (%s): %s", context, e)
        return HTTPException(
            status_code=504,
            detail={"error": "query_timeout", "message": "Query timed out", "detail": sanitize_detail(e)},
        )
    if isinstance(e, httpx.HTTPStatusError):
        logger.error("Superset error %s (%s): %s", e.response.status_code, context, e)
        return HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}", "detail": sanitize_detail(e)},
        )
    logger.exception("Unexpected error (%s)", context)
    return HTTPException(
        status_code=500,
        detail={"error": "internal_error", "message": "An unexpected error occurred", "detail": sanitize_detail(e)},
    )


@router.post("/kpi")
async def get_kpi(superset: SupersetDep, filters: GlobalFilters | None = None):
    if not superset:
        raise _superset_unavailable()

    try:
        breaks_filters = _build_superset_filters(filters, dataset="breaks")
        logger.info("KPI breaks filters: %s", breaks_filters)

        # Total breaks + status breakdown
        breaks_query: dict[str, Any] = {
            "columns": ["status"],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
            "filters": breaks_filters,
            "row_limit": 100,
        }
        breaks_result = await superset.get_chart_data(5, [breaks_query])
        breaks_data = breaks_result.get("result", [{}])[0].get("data", [])

        total_breaks = sum(r.get("COUNT(id)", 0) for r in breaks_data)
        resolved = sum(r.get("COUNT(id)", 0) for r in breaks_data if r.get("status") == "Resolved")
        open_breaks = sum(r.get("COUNT(id)", 0) for r in breaks_data if r.get("status") == "Open")

        # Avg aging for open breaks
        aging_query: dict[str, Any] = {
            "columns": [],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "aging_days"}, "aggregate": "AVG"}],
            "filters": [{"col": "status", "op": "!=", "val": "Resolved"}, *breaks_filters],
            "row_limit": 1,
        }
        aging_result = await superset.get_chart_data(5, [aging_query])
        aging_data = aging_result.get("result", [{}])[0].get("data", [{}])
        avg_age = aging_data[0].get("AVG(aging_days)", 0) if aging_data else 0

        # SLA breaches
        sla_query: dict[str, Any] = {
            "columns": [],
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
            "filters": [{"col": "sla_breach", "op": "==", "val": True}, *breaks_filters],
            "row_limit": 1,
        }
        sla_result = await superset.get_chart_data(5, [sla_query])
        sla_data = sla_result.get("result", [{}])[0].get("data", [{}])
        sla_breaches = sla_data[0].get("COUNT(id)", 0) if sla_data else 0

        # Transaction totals from daily_metrics (latest)
        metrics_query: dict[str, Any] = {
            "columns": [],
            "metrics": [
                {"expressionType": "SIMPLE", "column": {"column_name": "total_transactions"}, "aggregate": "SUM"},
                {"expressionType": "SIMPLE", "column": {"column_name": "match_rate"}, "aggregate": "AVG"},
                {"expressionType": "SIMPLE", "column": {"column_name": "break_amount"}, "aggregate": "SUM"},
            ],
            "row_limit": 1,
        }
        metrics_result = await superset.get_chart_data(6, [metrics_query])
        metrics_data = metrics_result.get("result", [{}])[0].get("data", [{}])
        m = metrics_data[0] if metrics_data else {}

        return {
            "total_breaks": total_breaks,
            "open_breaks": open_breaks,
            "resolution_rate": round((resolved / total_breaks * 100) if total_breaks else 0, 1),
            "avg_age_days": round(float(avg_age), 1),
            "sla_breaches": sla_breaches,
            "total_transactions": m.get("SUM(total_transactions)", 0),
            "match_rate": round(float(m.get("AVG(match_rate)", 0)), 1),
            "break_amount": float(m.get("SUM(break_amount)", 0)),
        }
    except Exception as e:
        raise _handle_httpx_error(e, "get_kpi")


@router.post("/aggregations")
async def get_aggregations(
    superset: SupersetDep,
    dataset_id: int = 5,
    group_by: list[str] | None = None,
    metric: str = "id",
    aggregate: str = "COUNT",
):
    if not group_by:
        group_by = ["category"]

    if not superset:
        raise _superset_unavailable()

    try:
        query: dict[str, Any] = {
            "columns": group_by,
            "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": metric}, "aggregate": aggregate}],
            "row_limit": 1000,
        }
        result = await superset.get_chart_data(dataset_id, [query])
        chart_result = result.get("result", [{}])[0]
        return {
            "data": chart_result.get("data", []),
            "row_count": chart_result.get("rowcount", 0),
        }
    except Exception as e:
        raise _handle_httpx_error(e, "get_aggregations")


@router.get("/counterparties")
async def list_counterparties(superset: SupersetDep, q: str = ""):
    if not superset:
        raise _superset_unavailable()
    try:
        query: dict[str, Any] = {
            "columns": ["name"],
            "metrics": [],
            "row_limit": 100,
            "order_desc": False,
            "orderby": [["name", True]],
        }
        if q:
            query["filters"] = [{"col": "name", "op": "ILIKE", "val": f"%{q}%"}]
        result = await superset.get_chart_data(3, [query])  # dataset 3 = counterparties
        data = result.get("result", [{}])[0].get("data", [])
        return [r.get("name", "") for r in data if r.get("name")]
    except Exception as e:
        raise _handle_httpx_error(e, "list_counterparties")
