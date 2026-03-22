from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_KPI
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


@router.post("/kpi")
async def get_kpi(superset: SupersetDep, filters: GlobalFilters | None = None):
    if superset:
        try:
            # KPI queries target breaks (dataset 5) and daily_metrics (dataset 6).
            # Neither has a counterparty column — entity filter applies to chart queries only.
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
        except Exception:
            pass

    return MOCK_KPI


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

    if superset:
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
        except Exception:
            pass

    return {"data": [], "row_count": 0}


MOCK_COUNTERPARTIES = [
    "JP Morgan", "Goldman Sachs", "Morgan Stanley", "Barclays", "HSBC",
    "Deutsche Bank", "UBS", "Credit Suisse", "BNP Paribas", "Societe Generale",
    "Nomura", "Mizuho", "MUFG", "Standard Chartered", "RBC",
]


@router.get("/counterparties")
async def list_counterparties(superset: SupersetDep, q: str = ""):
    if superset:
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
        except Exception:
            pass

    # Fallback to mock
    if q:
        return [c for c in MOCK_COUNTERPARTIES if q.lower() in c.lower()]
    return MOCK_COUNTERPARTIES
