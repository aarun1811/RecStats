from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_CHART_DATA, MOCK_CHARTS
from app.models.filters import ChartDataRequest

router = APIRouter(prefix="/api/charts", tags=["charts"])

# Map our chart slugs to Superset datasource IDs
CHART_DATASOURCE_MAP = {
    "break-trend": 5,
    "breaks-by-category": 5,
    "breaks-by-desk": 5,
    "aging-distribution": 5,
    "breaks-by-region": 5,
    "txn-volume-trend": 4,
    "txn-by-status": 4,
    "txn-by-region": 4,
    "match-rate-trend": 6,
    "daily-break-amount": 6,
}

# Chart query definitions — what to ask Superset for each chart
CHART_QUERIES: dict[str, dict[str, Any]] = {
    "break-trend": {
        "columns": ["created_date"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "order_desc": True,
        "row_limit": 10000,
    },
    "breaks-by-category": {
        "columns": ["category"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    },
    "breaks-by-desk": {
        "columns": ["desk"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    },
    "aging-distribution": {
        "columns": ["aging_bucket"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    },
    "breaks-by-region": {
        "columns": ["region"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    },
    "txn-volume-trend": {
        "columns": ["trade_date"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "order_desc": True,
        "row_limit": 10000,
    },
    "txn-by-status": {
        "columns": ["status"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    },
    "txn-by-region": {
        "columns": ["region"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "id"}, "aggregate": "COUNT"}],
        "row_limit": 100,
    },
    "match-rate-trend": {
        "columns": ["date"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "match_rate"}, "aggregate": "AVG"}],
        "order_desc": True,
        "row_limit": 10000,
    },
    "daily-break-amount": {
        "columns": ["date"],
        "metrics": [{"expressionType": "SIMPLE", "column": {"column_name": "break_amount"}, "aggregate": "SUM"}],
        "order_desc": True,
        "row_limit": 10000,
    },
}


def _build_superset_filters(filters: ChartDataRequest | None) -> list[dict]:
    """Convert our GlobalFilters into Superset adhoc_filters format."""
    if not filters or not filters.filters:
        return []

    adhoc: list[dict] = []
    f = filters.filters
    for col, values in [
        ("region", f.region), ("country", f.country), ("lob", f.lob),
        ("desk", f.desk), ("currency", f.currency), ("status", f.status),
        ("counterparty", f.counterparty),
    ]:
        if values:
            adhoc.append({
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": col,
                "operator": "IN",
                "comparator": values,
            })

    if f.date_from:
        adhoc.append({
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": "created_date",
            "operator": ">=",
            "comparator": f.date_from,
        })
    if f.date_to:
        adhoc.append({
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": "created_date",
            "operator": "<=",
            "comparator": f.date_to,
        })

    return adhoc


@router.get("")
async def list_charts(superset: SupersetDep):
    if superset:
        try:
            raw = await superset.list_charts()
            return [
                {
                    "id": str(c.get("id")),
                    "name": c.get("slice_name", ""),
                    "viz_type": c.get("viz_type", ""),
                    "datasource_id": c.get("datasource_id"),
                }
                for c in raw
            ]
        except Exception:
            pass
    return MOCK_CHARTS


@router.get("/{chart_id}")
async def get_chart(chart_id: str, superset: SupersetDep):
    if superset:
        try:
            raw = await superset.get_chart(int(chart_id))
            return raw
        except Exception:
            pass
    for c in MOCK_CHARTS:
        if c["id"] == chart_id:
            return c
    return {"error": "chart not found"}


@router.post("/{chart_id}/data")
async def get_chart_data(chart_id: str, superset: SupersetDep, body: ChartDataRequest | None = None):
    ds_id = CHART_DATASOURCE_MAP.get(chart_id)
    query_def = CHART_QUERIES.get(chart_id)

    if superset and ds_id and query_def:
        try:
            query = {**query_def}
            adhoc = _build_superset_filters(body)
            if adhoc:
                query["filters"] = adhoc

            result = await superset.get_chart_data(ds_id, [query])
            chart_result = result.get("result", [{}])[0]
            return {
                "chart_id": chart_id,
                "columns": list(chart_result.get("data", [{}])[0].keys()) if chart_result.get("data") else [],
                "data": chart_result.get("data", []),
                "row_count": chart_result.get("rowcount", 0),
            }
        except Exception:
            pass

    # Mock fallback
    mock = MOCK_CHART_DATA.get(chart_id, {"columns": [], "data": []})
    return {
        "chart_id": chart_id,
        "columns": mock.get("columns", []),
        "data": mock.get("data", []),
        "row_count": len(mock.get("data", [])),
    }
