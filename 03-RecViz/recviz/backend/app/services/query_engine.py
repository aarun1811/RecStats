from __future__ import annotations

import re
from typing import Any

from app.models.data_source_config import DataSourceConfig
from app.services.config_store import ConfigStore
from app.mock.query_results import MOCK_QUERY_RESULTS, MOCK_DISTINCT_VALUES

DEFAULT_MAX_ROWS = 10_000


class QueryEngine:
    """Builds SQL from config templates, resolves dynamic DB routing,
    and executes queries via Superset or returns mock data."""

    def __init__(
        self,
        config_store: ConfigStore,
        superset_client: Any | None = None,
    ) -> None:
        self._config_store = config_store
        self._superset = superset_client

    def _get_data_source(self, data_source_id: str) -> DataSourceConfig:
        ds = self._config_store.get_data_source(data_source_id)
        if ds is None:
            raise ValueError(f"Data source not found: {data_source_id}")
        return ds

    def _resolve_database(self, data_source_id: str, filters: dict) -> str:
        ds = self._get_data_source(data_source_id)
        routing = ds.database_routing

        if routing.type == "static":
            if routing.database is None:
                raise ValueError(
                    f"Data source '{data_source_id}' has static routing but no database configured"
                )
            return routing.database

        # dynamic routing
        filter_key = routing.route_by_filter
        filter_value = filters.get(filter_key)
        if not filter_value:
            raise ValueError(
                f"Data source '{data_source_id}' requires filter "
                f"'{filter_key}' for dynamic DB routing (required filter)"
            )
        if isinstance(filter_value, list):
            filter_value = filter_value[0]

        db_id = routing.mapping.get(filter_value)
        if not db_id:
            raise ValueError(
                f"No database mapping for {filter_key}='{filter_value}' "
                f"in data source '{data_source_id}'"
            )
        return db_id

    def _build_date_range_clause(self, value: int, dialect: str = "postgresql") -> str:
        if dialect == "oracle":
            if value == 1:
                return (
                    "BETWEEN TRUNC(SYSDATE) - "
                    "DECODE(TO_CHAR(SYSDATE,'D'), '1',2, '2',3, '7',1, 1) "
                    "AND SYSDATE"
                )
            return f"BETWEEN SYSDATE - {value} AND SYSDATE"
        else:
            return f"BETWEEN CURRENT_DATE - INTERVAL '{value} days' AND CURRENT_DATE"

    def _build_sql(
        self,
        data_source_id: str,
        filters: dict,
        column: str | None = None,
        dialect: str = "postgresql",
    ) -> str:
        ds = self._get_data_source(data_source_id)
        sql = ds.query

        # Replace {{column}} placeholder (used by filter options data sources)
        if column and "{{column}}" in sql:
            # Validate column against data source columns
            valid_columns = {c.name for c in ds.columns}
            if column not in valid_columns:
                raise ValueError(
                    f"Column '{column}' not in data source '{data_source_id}' "
                    f"columns: {valid_columns}"
                )
            sql = sql.replace("{{column}}", column)

        # Build filter clauses
        filter_clauses = []
        for fm in ds.filter_mappings:
            fval = filters.get(fm.filter_id)
            if fval is None:
                continue

            expr = fm.sql_expr
            if "{{date_range_clause}}" in expr:
                clause = self._build_date_range_clause(int(fval), dialect)
                expr = expr.replace("{{date_range_clause}}", clause)
            elif "{{values}}" in expr:
                if isinstance(fval, list):
                    quoted = ", ".join(f"'{v.replace(chr(39), chr(39)*2)}'" for v in fval)
                else:
                    quoted = f"'{str(fval).replace(chr(39), chr(39)*2)}'"
                expr = expr.replace("{{values}}", quoted)
            elif "{{value}}" in expr:
                val = fval[0] if isinstance(fval, list) else fval
                expr = expr.replace("{{value}}", str(val).replace("'", "''"))

            filter_clauses.append(f"AND {expr}")

        filters_sql = " ".join(filter_clauses)
        sql = sql.replace("{{filters}}", filters_sql)

        # Clean up any remaining template vars (no matching filter provided)
        sql = re.sub(r"\{\{[^}]+\}\}", "", sql)

        return sql

    async def execute(
        self,
        data_source_id: str,
        filters: dict,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> dict:
        if self._superset:
            return await self._execute_via_superset(
                data_source_id, filters, max_rows
            )
        return self._execute_mock(data_source_id, filters, max_rows)

    async def _execute_via_superset(
        self,
        data_source_id: str,
        filters: dict,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> dict:
        db_id = self._resolve_database(data_source_id, filters)
        sql = self._build_sql(data_source_id, filters, dialect="oracle")
        result = await self._superset.execute_sql(
            database_id=db_id,
            sql=sql,
        )
        if result and result.get("status") == "success":
            rows = result.get("data", [])
            truncated = len(rows) > max_rows
            if truncated:
                rows = rows[:max_rows]
            return {
                "columns": result.get("columns", []),
                "rows": rows,
                "row_count": len(rows),
                "truncated": truncated,
            }
        return {"columns": [], "rows": [], "row_count": 0, "truncated": False}

    def _execute_mock(
        self,
        data_source_id: str,
        filters: dict,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> dict:
        mock = MOCK_QUERY_RESULTS.get(data_source_id)
        if not mock:
            return {
                "columns": [],
                "rows": [],
                "row_count": 0,
                "truncated": False,
            }
        rows = mock["rows"]
        truncated = len(rows) > max_rows
        if truncated:
            rows = rows[:max_rows]
        return {
            "columns": mock["columns"],
            "rows": rows,
            "row_count": len(rows),
            "truncated": truncated,
        }

    async def execute_distinct(
        self,
        data_source_id: str,
        column: str,
        filters: dict,
    ) -> list[str]:
        if self._superset:
            return await self._execute_distinct_via_superset(
                data_source_id, column, filters
            )
        return self._execute_distinct_mock(data_source_id, column)

    async def _execute_distinct_via_superset(
        self,
        data_source_id: str,
        column: str,
        filters: dict,
    ) -> list[str]:
        db_id = self._resolve_database(data_source_id, filters)
        sql = self._build_sql(
            data_source_id, filters, column=column, dialect="oracle"
        )
        result = await self._superset.execute_sql(database_id=db_id, sql=sql)
        if result and result.get("data"):
            return [row.get(column, "") for row in result["data"]]
        return []

    def _execute_distinct_mock(
        self, data_source_id: str, column: str
    ) -> list[str]:
        ds_values = MOCK_DISTINCT_VALUES.get(data_source_id, {})
        return ds_values.get(column, [])
