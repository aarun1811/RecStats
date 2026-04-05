from __future__ import annotations

import re
from typing import Any

import httpx

from app.models.data_source_config import DataSourceConfig
from app.services.connection_status import ConnectionStatusTracker
from app.services.database_registrar import DatabaseRegistrar

DEFAULT_MAX_ROWS = 10_000

# Strings in Superset error responses that indicate a connection-level failure
# rather than a query-level error (bad SQL). Used to detect unreachable databases
# even when Superset returns HTTP 400 instead of 5xx.
# (Addresses review concern: Superset returns 400 with connection failure in body)
_CONNECTION_FAILURE_PATTERNS = (
    "connection refused",
    "could not connect",
    "connection failed",
    "connection timed out",
    "no listener",           # Oracle: TNS:no listener
    "ora-12541",             # Oracle: no listener
    "ora-12514",             # Oracle: service not found
    "ora-12170",             # Oracle: connect timeout
    "thrift.transport",      # Hive: Thrift transport errors
    "could not establish",
    "name or service not known",
    "connection reset",
)


def _is_connection_failure(error_text: str) -> bool:
    """Check if an error message indicates a connection-level failure."""
    lower = error_text.lower()
    return any(pattern in lower for pattern in _CONNECTION_FAILURE_PATTERNS)


class QueryEngine:
    """Builds SQL from config templates, resolves dynamic DB routing,
    and executes queries via Superset.

    Data source configs are resolved per-request by the caller (via
    ResolvedDataSourceDep or ConfigStore) and passed directly to execute().
    """

    def __init__(
        self,
        superset_client: Any,
        database_registrar: DatabaseRegistrar,
        status_tracker: ConnectionStatusTracker | None = None,
    ) -> None:
        self._superset = superset_client
        self._registrar = database_registrar
        self._status_tracker = status_tracker

    def _resolve_database(self, ds: DataSourceConfig, filters: dict) -> str:
        routing = ds.database_routing

        if routing.type == "static":
            if routing.database is None:
                raise ValueError(
                    f"Data source '{ds.id}' has static routing but no database configured"
                )
            return routing.database

        # dynamic routing
        if not routing.mapping:
            raise ValueError(
                f"Data source '{ds.id}' has dynamic routing but no mapping configured"
            )
        filter_key = routing.route_by_filter
        filter_value = filters.get(filter_key)
        if not filter_value:
            raise ValueError(
                f"Data source '{ds.id}' requires filter "
                f"'{filter_key}' for dynamic DB routing (required filter)"
            )
        if isinstance(filter_value, list):
            filter_value = filter_value[0]

        db_id = routing.mapping.get(filter_value)
        if not db_id:
            raise ValueError(
                f"No database mapping for {filter_key}='{filter_value}' "
                f"in data source '{ds.id}'"
            )
        return db_id

    def _build_date_range_clause(self, value: int, dialect: str = "oracle") -> str:
        if dialect == "oracle":
            if value == 1:
                return (
                    "BETWEEN TRUNC(SYSDATE) - "
                    "DECODE(TO_CHAR(SYSDATE,'D'), '1',2, '2',3, '7',1, 1) "
                    "AND SYSDATE"
                )
            return f"BETWEEN SYSDATE - {value} AND SYSDATE"
        elif dialect == "sqlite":
            return f"BETWEEN date('now', '-{value} days') AND date('now')"
        else:
            return f"BETWEEN CURRENT_DATE - INTERVAL '{value} days' AND CURRENT_DATE"

    def _build_sql(
        self,
        ds: DataSourceConfig,
        filters: dict,
        column: str | None = None,
        dialect: str = "oracle",
        db_name: str | None = None,
    ) -> str:
        sql = ds.query

        # Replace {{column}} placeholder (used by filter options data sources)
        if column and "{{column}}" in sql:
            # Validate column against data source columns
            valid_columns = {c.name for c in ds.columns}
            if column not in valid_columns:
                raise ValueError(
                    f"Column '{column}' not in data source '{ds.id}' "
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

        # Strip schema prefixes when the target database has no schema
        if db_name:
            schema = self._registrar.get_schema(db_name)
            if not schema:
                for known_schema in self._registrar.get_all_schemas():
                    if known_schema:
                        sql = re.sub(rf'\b{re.escape(known_schema)}\.', '', sql)

        return sql

    def _handle_connection_error(
        self, exc: Exception, db_id: int
    ) -> None:
        """Inspect an httpx exception and mark the database unreachable if
        the error indicates a connection-level failure."""
        if not self._status_tracker:
            return

        if isinstance(exc, httpx.ConnectError):
            self._status_tracker.mark_unreachable(db_id)
            return

        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            if status in (500, 502, 503):
                self._status_tracker.mark_unreachable(db_id)
            elif status == 400:
                # Superset returns 400 for some connection failures with error
                # details in the JSON body. Inspect the body to distinguish
                # connection failures from query errors (bad SQL).
                try:
                    body = exc.response.json()
                    error_text = str(body.get("message", ""))
                    errors_list = body.get("errors", [])
                    for err in errors_list:
                        error_text += " " + str(err.get("message", ""))
                        error_text += " " + str(
                            err.get("extra", {}).get("issue_codes", "")
                        )
                    if _is_connection_failure(error_text):
                        self._status_tracker.mark_unreachable(db_id)
                except Exception:
                    pass  # If body parsing fails, don't mask the original error

    async def execute(
        self,
        ds: DataSourceConfig,
        filters: dict,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> dict:
        """Execute a query for the given data source config and filters."""
        db_name = self._resolve_database(ds, filters)
        db_id = await self._registrar.resolve(db_name)
        dialect = self._registrar.get_dialect(db_name)
        schema = self._registrar.get_schema(db_name)
        sql = self._build_sql(
            ds, filters, dialect=dialect, db_name=db_name
        )

        try:
            result = await self._superset.execute_sql(
                database_id=db_id, sql=sql, schema=schema or "", limit=max_rows
            )
        except (httpx.ConnectError, httpx.HTTPStatusError) as exc:
            self._handle_connection_error(exc, db_id)
            raise

        # Success -- mark connected
        if self._status_tracker:
            self._status_tracker.mark_connected(db_id)

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

    async def execute_distinct(
        self,
        ds: DataSourceConfig,
        column: str,
        filters: dict,
    ) -> list[str]:
        """Execute a distinct values query for a specific column."""
        db_name = self._resolve_database(ds, filters)
        db_id = await self._registrar.resolve(db_name)
        dialect = self._registrar.get_dialect(db_name)
        schema = self._registrar.get_schema(db_name)
        sql = self._build_sql(
            ds, filters, column=column, dialect=dialect, db_name=db_name
        )

        try:
            result = await self._superset.execute_sql(
                database_id=db_id, sql=sql, schema=schema or ""
            )
        except (httpx.ConnectError, httpx.HTTPStatusError) as exc:
            self._handle_connection_error(exc, db_id)
            raise

        # Success -- mark connected
        if self._status_tracker:
            self._status_tracker.mark_connected(db_id)

        if result and result.get("data"):
            return [row.get(column, "") for row in result["data"]]
        return []
