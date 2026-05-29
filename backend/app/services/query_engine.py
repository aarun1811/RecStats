"""QueryExecutor -- direct SQL execution against sync engine pool.

Replaces the Superset-backed QueryEngine. Dataset SQL templates are built
via _build_sql() (filter injection, date range clauses) and executed directly
against the target database engine via text() + EngineManager.

Converted from async to sync on 2026-04-10 — see ``app/db/engine.py`` for
the rationale. Per-query execution timeouts are enforced at the driver level
via ``EngineManager._connect_args_for_backend`` (oracledb ``call_timeout``
for Oracle); SQLAlchemy's
``pool_timeout`` only bounds connection acquisition.

Response shape is identical to the Superset-era output:
  {columns: [{column_name, name, type, is_date}], rows: [{col: val}], row_count, truncated}
"""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session

from app.db.models.connection import RecvizConnection as ConnModel
from app.models.data_source_config import DataSourceConfig
from app.services.connection_status import ConnectionStatusTracker
from app.services.query_utils import build_result_response, wrap_with_pagination

if TYPE_CHECKING:
    from app.services.connection_resolver import ConnectionResolver
    from app.services.engine_manager import EngineManager

logger = logging.getLogger(__name__)

DEFAULT_MAX_ROWS = 10_000


class QueryExecutor:
    """Builds SQL from config templates, resolves dynamic DB routing,
    and executes queries directly via the sync engine pool.

    Data source configs are resolved per-request by the caller (via
    ResolvedDataSourceDep or ConfigStore) and passed directly to execute(),
    along with the request-scoped metadata-DB session used to look up the
    target RecvizConnection row (avoids opening a second session).
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

    def _build_date_range_clause(
        self,
        value: int,
        dialect: str = "oracle",
        *,
        exclude_today: bool = False,
    ) -> str:
        """Build a SQL BETWEEN clause for a relative date range.

        Default semantics (RecViz / QuickRec): inclusive of today —
            BETWEEN SYSDATE - N AND SYSDATE

        Legacy TLM semantics (``exclude_today=True``): exclusive of today —
            BETWEEN SYSDATE - N AND SYSDATE - 1
        Matches ``TlmStatsV2Service.getDateRangeClause`` (Java) lines 625-632.

        The dataset opts in via ``FilterMapping.options.exclude_today``.
        """
        end = "SYSDATE - 1" if exclude_today else "SYSDATE"

        if dialect == "oracle":
            if value == 1:
                return (
                    "BETWEEN TRUNC(SYSDATE) - "
                    "DECODE(TO_CHAR(SYSDATE,'D'), '1',2, '2',3, '7',1, 1) "
                    f"AND {end}"
                )
            return f"BETWEEN SYSDATE - {value} AND {end}"
        elif dialect == "sqlite":
            # SQLite branch: dev/test only. TLM datasets are Oracle-only, so
            # the exclude_today toggle currently has no SQLite analogue.
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

        # When the caller is the distinct-options endpoint, ALWAYS validate the
        # column name against the dataset's declared columns + identifier
        # whitelist (defense in depth) — execute_distinct relies on this guard
        # before wrapping the column into a SELECT DISTINCT.
        if column:
            valid_columns = {c.name for c in ds.columns}
            if column not in valid_columns:
                raise ValueError(
                    f"Column '{column}' not in data source '{ds.id}' "
                    f"columns: {valid_columns}"
                )
            if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', column):
                raise ValueError(f"Invalid column name: '{column}'")
            # Substitute the optional {{column}} placeholder (filter-options
            # datasets that pre-shape their own SELECT DISTINCT use this).
            if "{{column}}" in sql:
                sql = sql.replace("{{column}}", column)

        # Build filter clauses
        filter_clauses = []
        for fm in ds.filter_mappings:
            fval = filters.get(fm.filter_id)
            if fval is None:
                continue

            expr = fm.sql_expr
            if "{{date_range_clause}}" in expr:
                opts = fm.options or {}
                exclude_today = bool(opts.get("exclude_today", False))
                clause = self._build_date_range_clause(
                    int(fval), dialect, exclude_today=exclude_today
                )
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

    def execute(
        self,
        ds: DataSourceConfig,
        filters: dict,
        session: Session,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> dict:
        """Execute a query for the given data source config and filters.

        Uses direct text() execution against the sync engine pool. The
        provided ``session`` (request-scoped metadata DB session) is used
        to look up the target RecvizConnection row — avoids opening a
        second session per request. Response shape is identical to the
        Superset-era output for zero-change frontend compatibility.
        """
        db_name = self._resolve_database(ds, filters)
        connection_id = self._resolver.resolve(db_name)
        dialect = self._resolver.get_dialect(db_name)
        sql = self._build_sql(ds, filters, dialect=dialect, db_name=db_name)

        # Wrap with pagination to enforce max_rows at SQL level
        sql = wrap_with_pagination(sql, limit=max_rows, offset=0, dialect=dialect)

        try:
            # Look up the RecvizConnection via the request-scoped session
            result = session.execute(
                select(ConnModel).where(ConnModel.id == connection_id)
            )
            conn_record = result.scalar_one()
            engine = self._engine_manager.get_engine_for_connection(conn_record)

            with engine.connect() as conn:
                result = conn.execute(text(sql))
                # Get column descriptions before consuming rows
                cursor_desc = result.cursor.description or []
                column_descriptions = [
                    (col[0], col[1])
                    for col in cursor_desc
                ]
                rows = result.fetchall()

        except (OperationalError, DBAPIError):
            if self._status_tracker:
                self._status_tracker.mark_unreachable(connection_id)
            raise
        except Exception:
            raise

        if self._status_tracker:
            self._status_tracker.mark_connected(connection_id)

        return build_result_response(column_descriptions, rows, max_rows=max_rows)

    def execute_distinct(
        self,
        ds: DataSourceConfig,
        column: str,
        filters: dict,
        session: Session,
    ) -> list[str]:
        """Execute a distinct values query for a specific column.

        Returns a list of string values, excluding nulls. The provided
        ``session`` is the request-scoped metadata DB session used to
        look up the target connection row.
        """
        db_name = self._resolve_database(ds, filters)
        connection_id = self._resolver.resolve(db_name)
        dialect = self._resolver.get_dialect(db_name)
        sql = self._build_sql(ds, filters, column=column, dialect=dialect, db_name=db_name)

        # Datasets that pre-shape their own SELECT DISTINCT use the {{column}}
        # placeholder; for general datasets (multi-column SELECTs), wrap the
        # query so we extract DISTINCT values of the requested column.
        # `column` is already validated against ds.columns + identifier regex
        # by _build_sql above, so this interpolation is safe.
        if "{{column}}" not in ds.query:
            sql = (
                f"SELECT DISTINCT {column} AS value "
                f"FROM ({sql}) sub "
                f"WHERE {column} IS NOT NULL "
                f"ORDER BY {column}"
            )

        try:
            result = session.execute(
                select(ConnModel).where(ConnModel.id == connection_id)
            )
            conn_record = result.scalar_one()
            engine = self._engine_manager.get_engine_for_connection(conn_record)

            with engine.connect() as conn:
                result = conn.execute(text(sql))
                rows = result.fetchall()

        except (OperationalError, DBAPIError):
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
