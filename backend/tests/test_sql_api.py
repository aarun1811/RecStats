"""Tests for SQL Explorer API endpoints -- direct engine execution + read-only enforcement.

Tests mock:
- EngineManager (get_engine_for_connection returning a mock engine)
- DbSessionDep (async DB session for connection record lookup)
- In-memory query history
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _AsyncContextManager:
    """Minimal async context manager for mocking engine.connect()."""

    def __init__(self, value):
        self._value = value

    async def __aenter__(self):
        return self._value

    async def __aexit__(self, *args):
        return False


def _build_mock_engine(rows, cursor_description):
    """Build a mock async engine that returns the given rows + description."""
    mock_result = MagicMock()
    mock_result.cursor.description = cursor_description
    mock_result.fetchall.return_value = rows

    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock(return_value=mock_result)

    mock_engine = MagicMock()
    mock_engine.connect.return_value = _AsyncContextManager(mock_conn)

    return mock_engine, mock_conn


def _mock_conn_record(conn_id="uuid-1234", name="test_db", backend="postgresql"):
    """Create a mock RecvizConnection record."""
    record = MagicMock()
    record.id = conn_id
    record.name = name
    record.display_name = f"Test {name}"
    record.backend = backend
    return record


def _mock_session_with_record(conn_record):
    """Create a mock async session that returns the given connection record."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = conn_record

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    return mock_session


def _mock_session_no_record():
    """Create a mock async session that returns None (no record found)."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    return mock_session


def _mock_session_for_databases(records):
    """Create a mock async session for the databases list endpoint."""
    rows = []
    for r in records:
        row = MagicMock()
        row.id = r["id"]
        row.name = r["name"]
        row.display_name = r["display_name"]
        row.backend = r["backend"]
        rows.append(row)

    mock_result = MagicMock()
    mock_result.all.return_value = rows

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    return mock_session


def _create_test_app():
    """Create a test FastAPI app with the SQL router + dependency overrides."""
    from app.api.sql import router, _query_history
    from app.core.dependencies import get_db_session, get_engine_manager

    # Clear history between tests
    _query_history.clear()

    app = FastAPI()
    app.include_router(router)
    return app


def _override_deps(app, engine_manager=None, session=None):
    """Override FastAPI dependencies for testing."""
    from app.core.dependencies import get_db_session, get_engine_manager

    if engine_manager is not None:
        app.dependency_overrides[get_engine_manager] = lambda: engine_manager
    if session is not None:
        async def override_session():
            yield session
        app.dependency_overrides[get_db_session] = override_session


# ---------------------------------------------------------------------------
# Test 1: POST /api/sql/execute with valid SELECT returns success shape
# ---------------------------------------------------------------------------


class TestExecuteSuccess:
    def test_valid_select_returns_success_shape(self):
        """Test 1: POST /api/sql/execute with valid SELECT returns
        {status: "success", columns: [...], data: [...], row_count: N}"""
        app = _create_test_app()
        conn_record = _mock_conn_record()
        engine, _ = _build_mock_engine(
            rows=[(1, "alice"), (2, "bob")],
            cursor_description=[("ID", "NUMBER"), ("NAME", "VARCHAR")],
        )

        mgr = MagicMock()
        mgr.get_engine_for_connection = AsyncMock(return_value=engine)
        session = _mock_session_with_record(conn_record)
        _override_deps(app, engine_manager=mgr, session=session)

        client = TestClient(app)
        resp = client.post("/api/sql/execute", json={
            "sql": "SELECT id, name FROM users",
            "database_id": "uuid-1234",
            "limit": 1000,
        })

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "success"
        assert isinstance(body["columns"], list)
        assert isinstance(body["data"], list)
        assert body["row_count"] == 2
        # Verify column shape
        col = body["columns"][0]
        assert "column_name" in col
        assert "name" in col
        assert "type" in col
        assert "is_date" in col


# ---------------------------------------------------------------------------
# Tests 2-7: Read-only enforcement (QENG-04)
# ---------------------------------------------------------------------------


class TestReadOnlyEnforcement:
    """Tests 2-7: POST /api/sql/execute with destructive SQL returns 400."""

    @pytest.mark.parametrize("sql,label", [
        ("INSERT INTO users (name) VALUES ('x')", "INSERT"),
        ("DELETE FROM users WHERE id = 1", "DELETE"),
        ("DROP TABLE users", "DROP TABLE"),
        ("UPDATE users SET name = 'x' WHERE id = 1", "UPDATE"),
        ("ALTER TABLE users ADD COLUMN age INT", "ALTER"),
        ("TRUNCATE TABLE users", "TRUNCATE"),
    ])
    def test_destructive_sql_rejected(self, sql, label):
        """Tests 2-7: POST /api/sql/execute with {label} returns 400 read_only_violation."""
        app = _create_test_app()
        # No engine or session needed -- validation happens before execution
        _override_deps(app, engine_manager=MagicMock(), session=_mock_session_no_record())

        client = TestClient(app)
        resp = client.post("/api/sql/execute", json={
            "sql": sql,
            "database_id": "uuid-1234",
        })

        assert resp.status_code == 400
        body = resp.json()
        assert body["detail"]["error"] == "read_only_violation"


# ---------------------------------------------------------------------------
# Test 8: CTE (WITH) allowed
# ---------------------------------------------------------------------------


class TestCTEAllowed:
    def test_cte_select_allowed(self):
        """Test 8: POST /api/sql/execute with 'WITH cte AS (...) SELECT ...' is allowed."""
        app = _create_test_app()
        conn_record = _mock_conn_record()
        engine, _ = _build_mock_engine(
            rows=[(42,)],
            cursor_description=[("TOTAL", "NUMBER")],
        )

        mgr = MagicMock()
        mgr.get_engine_for_connection = AsyncMock(return_value=engine)
        session = _mock_session_with_record(conn_record)
        _override_deps(app, engine_manager=mgr, session=session)

        client = TestClient(app)
        resp = client.post("/api/sql/execute", json={
            "sql": "WITH cte AS (SELECT COUNT(*) AS total FROM users) SELECT total FROM cte",
            "database_id": "uuid-1234",
        })

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "success"


# ---------------------------------------------------------------------------
# Test 9: History recorded on success
# ---------------------------------------------------------------------------


class TestHistoryTracking:
    def test_success_records_history(self):
        """Test 9: POST /api/sql/execute records history entry on success."""
        app = _create_test_app()
        conn_record = _mock_conn_record()
        engine, _ = _build_mock_engine(
            rows=[(1,)],
            cursor_description=[("ID", "NUMBER")],
        )

        mgr = MagicMock()
        mgr.get_engine_for_connection = AsyncMock(return_value=engine)
        session = _mock_session_with_record(conn_record)
        _override_deps(app, engine_manager=mgr, session=session)

        client = TestClient(app)
        client.post("/api/sql/execute", json={
            "sql": "SELECT 1",
            "database_id": "uuid-1234",
        })

        # Check history
        resp = client.get("/api/sql/history")
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) >= 1
        assert history[0]["status"] == "success"
        assert history[0]["sql"] == "SELECT 1"

    def test_error_records_history(self):
        """Test 10: POST /api/sql/execute records history entry on error (read-only violation)."""
        app = _create_test_app()
        _override_deps(app, engine_manager=MagicMock(), session=_mock_session_no_record())

        client = TestClient(app)
        client.post("/api/sql/execute", json={
            "sql": "DROP TABLE users",
            "database_id": "uuid-1234",
        })

        resp = client.get("/api/sql/history")
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) >= 1
        assert history[0]["status"] == "error"
        assert "read_only" in history[0]["error"].lower() or "Read-only" in history[0]["error"]


# ---------------------------------------------------------------------------
# Test 11: GET /api/sql/databases returns from recviz_connections
# ---------------------------------------------------------------------------


class TestDatabasesList:
    def test_databases_from_recviz_connections(self):
        """Test 11: GET /api/sql/databases returns list from recviz_connections table."""
        app = _create_test_app()
        session = _mock_session_for_databases([
            {"id": "uuid-1", "name": "dev_pg", "display_name": "Dev PostgreSQL", "backend": "postgresql"},
            {"id": "uuid-2", "name": "prod_ora", "display_name": "Prod Oracle", "backend": "oracle"},
        ])
        _override_deps(app, session=session)

        client = TestClient(app)
        resp = client.get("/api/sql/databases")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["id"] == "uuid-1"
        assert data[0]["database_name"] == "dev_pg"
        assert data[0]["display_name"] == "Dev PostgreSQL"
        assert data[0]["backend"] == "postgresql"
        assert data[1]["id"] == "uuid-2"


# ---------------------------------------------------------------------------
# Test 12: GET /api/sql/history returns recent entries
# ---------------------------------------------------------------------------


class TestHistoryEndpoint:
    def test_history_returns_entries(self):
        """Test 12: GET /api/sql/history returns recent history entries."""
        app = _create_test_app()
        _override_deps(app, engine_manager=MagicMock(), session=_mock_session_no_record())

        client = TestClient(app)
        # Execute a couple queries to build history (they'll fail with read-only but still tracked)
        client.post("/api/sql/execute", json={"sql": "INSERT INTO x VALUES(1)", "database_id": "uuid-1"})

        resp = client.get("/api/sql/history")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1


# ---------------------------------------------------------------------------
# Test 13: database_id as string (connection UUID) works
# ---------------------------------------------------------------------------


class TestStringDatabaseId:
    def test_string_database_id(self):
        """Test 13: POST /api/sql/execute with database_id as string (connection UUID) works."""
        app = _create_test_app()
        conn_record = _mock_conn_record(conn_id="abc-def-ghi")
        engine, _ = _build_mock_engine(
            rows=[(99,)],
            cursor_description=[("VAL", "NUMBER")],
        )

        mgr = MagicMock()
        mgr.get_engine_for_connection = AsyncMock(return_value=engine)
        session = _mock_session_with_record(conn_record)
        _override_deps(app, engine_manager=mgr, session=session)

        client = TestClient(app)
        resp = client.post("/api/sql/execute", json={
            "sql": "SELECT 99 AS val",
            "database_id": "abc-def-ghi",
        })

        assert resp.status_code == 200
        assert resp.json()["status"] == "success"


# ---------------------------------------------------------------------------
# Test 14: Timeout returns 504
# ---------------------------------------------------------------------------


class TestTimeout:
    def test_timeout_returns_504(self):
        """Test 14: POST /api/sql/execute with timeout returns 504 error."""
        app = _create_test_app()
        conn_record = _mock_conn_record()

        # Build engine whose conn.execute raises TimeoutError
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(side_effect=asyncio.TimeoutError())
        mock_engine = MagicMock()
        mock_engine.connect.return_value = _AsyncContextManager(mock_conn)

        mgr = MagicMock()
        mgr.get_engine_for_connection = AsyncMock(return_value=mock_engine)
        session = _mock_session_with_record(conn_record)
        _override_deps(app, engine_manager=mgr, session=session)

        client = TestClient(app)
        resp = client.post("/api/sql/execute", json={
            "sql": "SELECT * FROM huge_table",
            "database_id": "uuid-1234",
        })

        assert resp.status_code == 504
        body = resp.json()
        assert body["detail"]["error"] == "query_timeout"


# ---------------------------------------------------------------------------
# Test 15: Database not found returns 404
# ---------------------------------------------------------------------------


class TestDatabaseNotFound:
    def test_unknown_database_returns_404(self):
        """Bonus: POST /api/sql/execute with unknown database_id returns 404."""
        app = _create_test_app()
        session = _mock_session_no_record()

        mgr = MagicMock()
        _override_deps(app, engine_manager=mgr, session=session)

        client = TestClient(app)
        resp = client.post("/api/sql/execute", json={
            "sql": "SELECT 1",
            "database_id": "nonexistent-uuid",
        })

        assert resp.status_code == 404
        body = resp.json()
        assert body["detail"]["error"] == "database_not_found"
