"""QueryExecutor -- direct SQL execution against async engine pool.

Replaces the Superset-backed QueryEngine. Dataset SQL templates are built
via _build_sql() (filter injection, date range clauses) and executed directly
against the target database engine via text() + EngineManager.

Response shape is identical to the Superset-era output:
  {columns: [{column_name, name, type, is_date}], rows: [{col: val}], row_count, truncated}
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import TYPE_CHECKING

from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, OperationalError

from app.db.engine import async_session_factory
from app.db.models.connection import RecvizConnection as ConnModel
from app.models.data_source_config import DataSourceConfig
from app.services.connection_status import ConnectionStatusTracker
from app.services.query_utils import build_result_response, wrap_with_pagination

if TYPE_CHECKING:
    from app.services.connection_resolver import ConnectionResolver
    from app.services.engine_manager import EngineManager

logger = logging.getLogger(__name__)

DEFAULT_MAX_ROWS = 10_000

# Query timeout for dashboard queries (seconds)
_QUERY_TIMEOUT = 30.0


class QueryExecutor:
    """Builds SQL from config templates, resolves dynamic DB routing,
    and executes queries directly via async engine pool.

    Data source configs are resolved per-request by the caller (via
    ResolvedDataSourceDep or ConfigStore) and passed directly to execute().
    """

    def __init__(
        self,
        engine_manager: EngineManager,
        connection_resolver: ConnectionResolver,
        status_tracker: ConnectionStatusTracker | None = None,
    ) -> None:
        self._engine_manager = engine_manager
        self._resolver = connection_resolver
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
            schema = self._resolver.get_schema(db_name)
            if not schema:
                for known_schema in self._resolver.get_all_schemas():
                    if known_schema:
                        sql = re.sub(rf'\b{re.escape(known_schema)}\.', '', sql)

        return sql

    async def execute(
        self,
        ds: DataSourceConfig,
        filters: dict,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> dict:
        """Execute a query for the given data source config and filters.

        Uses direct text() execution against the async engine pool instead of
        proxying through Superset. Response shape is identical to Superset-era
        output for zero-change frontend compatibility.
        """
        db_name = self._resolve_database(ds, filters)
        connection_id = await self._resolver.resolve(db_name)
        dialect = self._resolver.get_dialect(db_name)
        sql = self._build_sql(ds, filters, dialect=dialect, db_name=db_name)

        # Wrap with pagination to enforce max_rows at SQL level
        sql = wrap_with_pagination(sql, limit=max_rows, offset=0, dialect=dialect)

        try:
            # Get the RecvizConnection record to build engine
            async with async_session_factory() as session:
                result = await session.execute(
                    select(ConnModel).where(ConnModel.id == connection_id)
                )
                conn_record = result.scalar_one()
            engine = await self._engine_manager.get_engine_for_connection(conn_record)

            async with engine.connect() as conn:
                result = await asyncio.wait_for(
                    conn.execute(text(sql)),
                    timeout=_QUERY_TIMEOUT,
                )
                # Get column descriptions before consuming rows
                cursor_desc = result.cursor.description or []
                column_descriptions = [
                    (col[0], getattr(col[1], "__name__", str(col[1])))
                    for col in cursor_desc
                ]
                rows = result.fetchall()

        except asyncio.TimeoutError:
            if self._status_tracker:
                self._status_tracker.mark_unreachable(connection_id)
            raise
        except (OperationalError, DBAPIError) as exc:
            if self._status_tracker:
                self._status_tracker.mark_unreachable(connection_id)
            raise
        except Exception:
            raise

        if self._status_tracker:
            self._status_tracker.mark_connected(connection_id)

        return build_result_response(column_descriptions, rows, max_rows=max_rows)

    async def execute_distinct(
        self,
        ds: DataSourceConfig,
        column: str,
        filters: dict,
    ) -> list[str]:
        """Execute a distinct values query for a specific column.

        Returns a list of string values, excluding nulls.
        """
        db_name = self._resolve_database(ds, filters)
        connection_id = await self._resolver.resolve(db_name)
        dialect = self._resolver.get_dialect(db_name)
        sql = self._build_sql(ds, filters, column=column, dialect=dialect, db_name=db_name)

        try:
            async with async_session_factory() as session:
                result = await session.execute(
                    select(ConnModel).where(ConnModel.id == connection_id)
                )
                conn_record = result.scalar_one()
            engine = await self._engine_manager.get_engine_for_connection(conn_record)

            async with engine.connect() as conn:
                result = await asyncio.wait_for(
                    conn.execute(text(sql)),
                    timeout=_QUERY_TIMEOUT,
                )
                rows = result.fetchall()

        except (asyncio.TimeoutError, OperationalError, DBAPIError) as exc:
            if self._status_tracker:
                self._status_tracker.mark_unreachable(connection_id)
            raise

        if self._status_tracker:
            self._status_tracker.mark_connected(connection_id)

        if rows:
            return [str(row[0]) for row in rows if row[0] is not None]
        return []


# Backward compatibility alias
QueryEngine = QueryExecutor
