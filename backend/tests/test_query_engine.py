"""Tests for QueryExecutor -- direct text() execution against engine pool.

Tests mock:
- ConnectionResolver (resolve, get_dialect, get_schema, get_all_schemas)
- EngineManager (get_engine_for_connection returning a mock engine)
- async_session_factory (for connection record lookup)
- ConnectionStatusTracker (mark_connected, mark_unreachable)
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.data_source_config import (
    ColumnDef,
    DataSourceConfig,
    DatabaseRoutingMapping,
    FilterMapping,
)
from app.services.connection_status import ConnectionStatusTracker


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_ds(
    ds_id: str = "test_ds",
    query: str = "SELECT * FROM test_table WHERE 1=1 {{filters}}",
    database: str = "test_db",
    routing_type: str = "static",
    filter_mappings: list | None = None,
    columns: list | None = None,
    route_by_filter: str | None = None,
    mapping: dict | None = None,
) -> DataSourceConfig:
    """Create a DataSourceConfig for testing."""
    return DataSourceConfig(
        id=ds_id,
        name=f"Test {ds_id}",
        database_routing=DatabaseRoutingMapping(
            type=routing_type,
            database=database,
            route_by_filter=route_by_filter,
            mapping=mapping,
        ),
        query=query,
        filter_mappings=[FilterMapping(**fm) for fm in (filter_mappings or [])],
        columns=[ColumnDef(**c) for c in (columns or [])],
    )


@pytest.fixture
def mock_resolver():
    resolver = MagicMock()
    resolver.resolve = AsyncMock(return_value="uuid-1234")
    resolver.get_dialect.return_value = "postgresql"
    resolver.get_schema.return_value = ""
    resolver.get_all_schemas.return_value = set()
    return resolver


@pytest.fixture
def mock_engine_manager():
    mgr = MagicMock()
    mgr.get_engine_for_connection = AsyncMock()
    return mgr


@pytest.fixture
def mock_status_tracker():
    return MagicMock(spec=ConnectionStatusTracker)


@pytest.fixture
def mock_conn_record():
    """A mock RecvizConnection ORM object."""
    record = MagicMock()
    record.id = "uuid-1234"
    record.name = "test_db"
    record.backend = "postgresql"
    return record


class _AsyncContextManager:
    """Minimal async context manager for mocking engine.connect()."""

    def __init__(self, value):
        self._value = value

    async def __aenter__(self):
        return self._value

    async def __aexit__(self, *args):
        return False


def _build_mock_engine(rows, cursor_description):
    """Build a mock async engine that returns the given rows + description.

    Returns (mock_engine, mock_connection) so tests can inspect calls.
    """
    mock_result = MagicMock()
    mock_result.cursor.description = cursor_description
    mock_result.fetchall.return_value = rows

    mock_conn = AsyncMock()
    # conn.execute(text(sql)) returns a coroutine that resolves to mock_result
    mock_conn.execute = AsyncMock(return_value=mock_result)

    mock_engine = MagicMock()
    # engine.connect() returns an async context manager (not a coroutine)
    mock_engine.connect.return_value = _AsyncContextManager(mock_conn)

    return mock_engine, mock_conn


def _patch_session(mock_conn_record):
    """Create a patch context for async_session_factory that returns the mock connection record."""
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = mock_conn_record

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_factory = MagicMock()
    mock_factory.return_value = _AsyncContextManager(mock_session)

    return patch("app.services.query_engine.async_session_factory", mock_factory)


# ---------------------------------------------------------------------------
# Test 1: execute() calls connection_resolver.resolve() with resolved DB name
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_calls_resolver_resolve(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(database="my_db")
    engine, _ = _build_mock_engine(
        rows=[(1, "a")],
        cursor_description=[("ID", "NUMBER"), ("NAME", "VARCHAR")],
    )
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        await executor.execute(ds, filters={})

    mock_resolver.resolve.assert_awaited_once_with("my_db")


# ---------------------------------------------------------------------------
# Test 2: execute() calls engine_manager.get_engine_for_connection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_calls_engine_manager(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds()
    engine, _ = _build_mock_engine(
        rows=[], cursor_description=[],
    )
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        await executor.execute(ds, filters={})

    mock_engine_manager.get_engine_for_connection.assert_awaited_once_with(mock_conn_record)


# ---------------------------------------------------------------------------
# Test 3: execute() executes text(sql) on the engine connection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_runs_text_sql_on_connection(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(query="SELECT id, name FROM users WHERE 1=1 {{filters}}")
    engine, mock_conn = _build_mock_engine(
        rows=[(1, "alice")],
        cursor_description=[("ID", "NUMBER"), ("NAME", "VARCHAR")],
    )
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        await executor.execute(ds, filters={})

    # Verify conn.execute was called (with a text() object)
    mock_conn.execute.assert_awaited_once()
    call_args = mock_conn.execute.call_args
    from sqlalchemy import text
    assert hasattr(call_args[0][0], "text")  # It's a TextClause


# ---------------------------------------------------------------------------
# Test 4: execute() returns {columns, rows, row_count, truncated}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_returns_correct_response_shape(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds()
    engine, _ = _build_mock_engine(
        rows=[(1, "alice"), (2, "bob")],
        cursor_description=[("ID", "NUMBER"), ("NAME", "VARCHAR")],
    )
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        result = await executor.execute(ds, filters={})

    assert "columns" in result
    assert "rows" in result
    assert "row_count" in result
    assert "truncated" in result

    assert result["row_count"] == 2
    assert result["truncated"] is False

    # Columns follow the contract: column_name, name, type, is_date
    col = result["columns"][0]
    assert "column_name" in col
    assert "name" in col
    assert "type" in col
    assert "is_date" in col

    # Rows are dicts keyed by lowercase column name
    row = result["rows"][0]
    assert "id" in row
    assert "name" in row


# ---------------------------------------------------------------------------
# Test 5: execute() marks connection as connected on success
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_marks_connected_on_success(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds()
    engine, _ = _build_mock_engine(
        rows=[(1,)], cursor_description=[("ID", "NUMBER")],
    )
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        await executor.execute(ds, filters={})

    mock_status_tracker.mark_connected.assert_called_once_with("uuid-1234")


# ---------------------------------------------------------------------------
# Test 6: execute() marks unreachable on OperationalError
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_marks_unreachable_on_operational_error(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from sqlalchemy.exc import OperationalError

    from app.services.query_engine import QueryExecutor

    ds = _make_ds()

    # Build engine whose conn.execute raises OperationalError
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock(
        side_effect=OperationalError("conn failed", {}, Exception())
    )
    mock_engine = MagicMock()
    mock_engine.connect.return_value = _AsyncContextManager(mock_conn)
    mock_engine_manager.get_engine_for_connection.return_value = mock_engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        with pytest.raises(OperationalError):
            await executor.execute(ds, filters={})

    mock_status_tracker.mark_unreachable.assert_called_once_with("uuid-1234")


# ---------------------------------------------------------------------------
# Test 7: execute_distinct() returns list of lowercase string values
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_distinct_returns_string_list(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(
        query="SELECT DISTINCT {{column}} FROM test_table WHERE 1=1 {{filters}}",
        columns=[{"name": "status", "type": "string"}],
    )
    engine, _ = _build_mock_engine(
        rows=[("OPEN",), ("CLOSED",), (None,)],
        cursor_description=[("STATUS", "VARCHAR")],
    )
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        values = await executor.execute_distinct(ds, column="status", filters={})

    # Returns strings, excluding None
    assert values == ["OPEN", "CLOSED"]
    assert None not in values


# ---------------------------------------------------------------------------
# Test 8: _build_sql() preserves filter injection logic
# ---------------------------------------------------------------------------


def test_build_sql_preserves_filter_injection(mock_resolver):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(
        query="SELECT * FROM t WHERE 1=1 {{filters}}",
        filter_mappings=[
            {"filter_id": "recon", "sql_expr": "agent_code IN ({{values}})"},
            {"filter_id": "date_range", "sql_expr": "created {{date_range_clause}}"},
        ],
    )

    executor = QueryExecutor(
        engine_manager=MagicMock(),
        connection_resolver=mock_resolver,
    )

    sql = executor._build_sql(ds, filters={"recon": ["AGENT_01"], "date_range": 7}, dialect="oracle")
    assert "agent_code IN ('AGENT_01')" in sql
    assert "SYSDATE" in sql


# ---------------------------------------------------------------------------
# Test 9: _resolve_database() preserves static + dynamic routing
# ---------------------------------------------------------------------------


def test_resolve_database_static_routing(mock_resolver):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(database="my_static_db", routing_type="static")
    executor = QueryExecutor(
        engine_manager=MagicMock(),
        connection_resolver=mock_resolver,
    )

    result = executor._resolve_database(ds, filters={})
    assert result == "my_static_db"


def test_resolve_database_dynamic_routing(mock_resolver):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(
        routing_type="dynamic",
        route_by_filter="region",
        mapping={"US": "us_db", "EU": "eu_db"},
    )
    executor = QueryExecutor(
        engine_manager=MagicMock(),
        connection_resolver=mock_resolver,
    )

    result = executor._resolve_database(ds, filters={"region": "US"})
    assert result == "us_db"


def test_resolve_database_dynamic_missing_filter_raises(mock_resolver):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(
        routing_type="dynamic",
        route_by_filter="region",
        mapping={"US": "us_db"},
    )
    executor = QueryExecutor(
        engine_manager=MagicMock(),
        connection_resolver=mock_resolver,
    )

    with pytest.raises(ValueError, match="required filter"):
        executor._resolve_database(ds, filters={})


# ---------------------------------------------------------------------------
# Test 10: execute() uses wrap_with_pagination for max_rows
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_uses_wrap_with_pagination(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(query="SELECT * FROM big_table WHERE 1=1 {{filters}}")
    engine, mock_conn = _build_mock_engine(
        rows=[(1,)], cursor_description=[("ID", "NUMBER")],
    )
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        await executor.execute(ds, filters={}, max_rows=500)

    # The SQL passed to conn.execute should contain LIMIT (postgresql dialect)
    call_args = mock_conn.execute.call_args
    sql_text = str(call_args[0][0])
    assert "LIMIT 500" in sql_text


# ---------------------------------------------------------------------------
# Test: _build_date_range_clause preserved for Oracle and PostgreSQL
# ---------------------------------------------------------------------------


def test_date_range_oracle_single_day(mock_resolver):
    from app.services.query_engine import QueryExecutor

    executor = QueryExecutor(
        engine_manager=MagicMock(),
        connection_resolver=mock_resolver,
    )
    clause = executor._build_date_range_clause(1, dialect="oracle")
    assert "TRUNC(SYSDATE)" in clause
    assert "DECODE" in clause


def test_date_range_oracle_multi_day(mock_resolver):
    from app.services.query_engine import QueryExecutor

    executor = QueryExecutor(
        engine_manager=MagicMock(),
        connection_resolver=mock_resolver,
    )
    clause = executor._build_date_range_clause(7, dialect="oracle")
    assert "SYSDATE - 7" in clause


def test_date_range_postgresql(mock_resolver):
    from app.services.query_engine import QueryExecutor

    executor = QueryExecutor(
        engine_manager=MagicMock(),
        connection_resolver=mock_resolver,
    )
    clause = executor._build_date_range_clause(7, dialect="postgresql")
    assert "INTERVAL '7 days'" in clause


# ---------------------------------------------------------------------------
# Test: backward compat alias
# ---------------------------------------------------------------------------


def test_query_engine_alias():
    from app.services.query_engine import QueryEngine, QueryExecutor

    assert QueryEngine is QueryExecutor
