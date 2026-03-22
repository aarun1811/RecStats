"""Custom business-logic aggregation service.

Provides recon-specific computed metrics that aren't suited for raw
Superset SQL queries (weighted aging, rolling rates, break velocity).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.models.filters import GlobalFilters
from app.services.filter_converter import to_superset_filters

if TYPE_CHECKING:
    from app.services.superset_client import SupersetClient


class AggregationService:
    """Custom business logic aggregations on top of Superset data."""

    def __init__(self, superset_client: SupersetClient):
        self._superset = superset_client

    async def weighted_aging(self, filters: dict) -> dict:
        """Break amount x days outstanding, grouped by desk/type.

        Returns buckets with desk, break_type, weighted_amount.
        """
        global_filters = GlobalFilters(**filters) if filters else GlobalFilters()
        superset_filters = [f.model_dump() for f in to_superset_filters(global_filters)]

        # Use SQL to compute the weighted aging from the recon dataset
        sql = """
            SELECT
                desk,
                break_type,
                SUM(break_amount * days_outstanding) AS weighted_amount,
                COUNT(*) AS break_count,
                AVG(days_outstanding) AS avg_days
            FROM recon_breaks
            WHERE 1=1
            GROUP BY desk, break_type
            ORDER BY weighted_amount DESC
        """
        # database_id=1 is the primary recon database
        result = await self._superset.execute_sql(database_id=1, sql=sql)
        return {
            "metric": "weighted_aging",
            "filters": superset_filters,
            "data": result.get("data", []),
            "columns": result.get("columns", []),
        }

    async def rolling_recon_rate(
        self,
        filters: dict,
        trailing_days: int = 30,
    ) -> dict:
        """Matched / total over trailing N days, daily data points.

        Returns a time series of daily recon rates.
        """
        global_filters = GlobalFilters(**filters) if filters else GlobalFilters()
        superset_filters = [f.model_dump() for f in to_superset_filters(global_filters)]

        sql = f"""
            SELECT
                recon_date,
                COUNT(CASE WHEN status = 'matched' THEN 1 END) AS matched_count,
                COUNT(*) AS total_count,
                ROUND(
                    COUNT(CASE WHEN status = 'matched' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
                    2
                ) AS recon_rate_pct
            FROM recon_items
            WHERE recon_date >= CURRENT_DATE - INTERVAL '{trailing_days}' DAY
            GROUP BY recon_date
            ORDER BY recon_date
        """
        result = await self._superset.execute_sql(database_id=1, sql=sql)
        return {
            "metric": "rolling_recon_rate",
            "trailing_days": trailing_days,
            "filters": superset_filters,
            "data": result.get("data", []),
            "columns": result.get("columns", []),
        }

    async def break_velocity(
        self,
        filters: dict,
        period: str = "daily",
    ) -> dict:
        """Rate of new breaks vs resolved breaks over time.

        Returns time series with new_breaks, resolved_breaks, net_change.
        """
        global_filters = GlobalFilters(**filters) if filters else GlobalFilters()
        superset_filters = [f.model_dump() for f in to_superset_filters(global_filters)]

        # Adapt truncation function to period
        trunc_expr = {
            "daily": "TRUNC(event_date)",
            "weekly": "TRUNC(event_date, 'IW')",
            "monthly": "TRUNC(event_date, 'MM')",
        }.get(period, "TRUNC(event_date)")

        sql = f"""
            SELECT
                {trunc_expr} AS period_start,
                COUNT(CASE WHEN event_type = 'new_break' THEN 1 END) AS new_breaks,
                COUNT(CASE WHEN event_type = 'resolved' THEN 1 END) AS resolved_breaks,
                COUNT(CASE WHEN event_type = 'new_break' THEN 1 END)
                    - COUNT(CASE WHEN event_type = 'resolved' THEN 1 END) AS net_change
            FROM break_events
            GROUP BY {trunc_expr}
            ORDER BY period_start
        """
        result = await self._superset.execute_sql(database_id=1, sql=sql)
        return {
            "metric": "break_velocity",
            "period": period,
            "filters": superset_filters,
            "data": result.get("data", []),
            "columns": result.get("columns", []),
        }
