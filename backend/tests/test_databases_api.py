"""Tests for Database CRUD API endpoints -- direct recviz_connections access.

Tests mock:
- DbSessionDep (async DB session for connection record CRUD)
- EngineManager (dispose_engine, test_connection)
- EncryptionService (encrypt/decrypt passwords)
- ConnectionStatusTracker (in-memory status tracking)
- ConnectionResolver (cache invalidation on mutations)
"""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.services.connection_status import ConnectionStatusTracker


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_connection(
    conn_id="uuid-1234",
    name="dev_pg",
    display_name="Dev PostgreSQL",
    backend="postgresql",
    host="localhost",
    port=5432,
    database_name="recviz",
    username="admin",
    encrypted_password="ENCRYPTED_pw",
    schema_name="",
    extra_params=None,
    status="untested",
    last_tested_at=None,
    created_at=None,
    updated_at=None,
):
    """Create a mock RecvizConnection ORM object."""
    conn = MagicMock()
    conn.id = conn_id
    conn.name = name
    conn.display_name = display_name
    conn.backend = backend
    conn.host = host
    conn.port = port
    conn.database_name = database_name
    conn.username = username
    conn.encrypted_password = encrypted_password
    conn.schema_name = schema_name
    conn.extra_params = extra_params
    conn.status = status
    conn.last_tested_at = last_tested_at
    conn.created_at = created_at or datetime(2026, 1, 1, tzinfo=timezone.utc)
    conn.updated_at = updated_at or datetime(2026, 1, 1, tzinfo=timezone.utc)
    return conn


def _mock_session_returning_list(connections):
    """Mock session for list queries -- scalars().all() returns list."""
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = connections

    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.delete = AsyncMock()
    return session


def _mock_session_returning_one(connection):
    """Mock session for single-row queries -- scalar_one_or_none() returns connection or None."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = connection

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.delete = AsyncMock()
    return session


def _mock_encryption():
    """Mock EncryptionService."""
    enc = MagicMock()
    enc.encrypt.return_value = "ENCRYPTED_value"
    enc.decrypt.return_value = "decrypted_password"
    return enc


def _mock_engine_manager():
    """Mock EngineManager."""
    mgr = MagicMock()
    mgr.dispose_engine = AsyncMock()
    return mgr


def _mock_resolver():
    """Mock ConnectionResolver."""
    resolver = MagicMock()
    resolver.invalidate = AsyncMock()
    return resolver


def _create_test_app():
    """Create a test FastAPI app with the databases router."""
    from app.api.databases import router

    app = FastAPI()
    app.include_router(router)

    # Set up app state
    app.state.connection_status = ConnectionStatusTracker()
    app.state.encryption = _mock_encryption()
    app.state.connection_resolver = _mock_resolver()

    return app


def _override_deps(app, session=None, engine_manager=None):
    """Override FastAPI dependencies for testing."""
    from app.core.dependencies import get_db_session, get_engine_manager

    if session is not None:
        async def override_session():
            yield session
        app.dependency_overrides[get_db_session] = override_session

    if engine_manager is not None:
        app.dependency_overrides[get_engine_manager] = lambda: engine_manager


# ---------------------------------------------------------------------------
# Test 1: GET /api/databases returns list of connections from DB
# ---------------------------------------------------------------------------


class TestListDatabases:
    def test_list_databases(self):
        """GET /api/databases returns list of connections from recviz_connections."""
        app = _create_test_app()
        conns = [
            _mock_connection(conn_id="uuid-1", name="dev_pg", display_name="Dev PostgreSQL", backend="postgresql"),
            _mock_connection(conn_id="uuid-2", name="prod_ora", display_name="Prod Oracle", backend="oracle"),
        ]
        session = _mock_session_returning_list(conns)
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.get("/api/databases")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["id"] == "uuid-1"
        assert data[0]["database_name"] == "Dev PostgreSQL"
        assert data[0]["backend"] == "postgresql"
        assert data[0]["status"] == "untested"
        assert data[1]["id"] == "uuid-2"


# ---------------------------------------------------------------------------
# Test 2: GET /api/databases/{id} returns single connection
# ---------------------------------------------------------------------------


class TestGetDatabase:
    def test_get_database(self):
        """GET /api/databases/{id} returns single connection."""
        app = _create_test_app()
        conn = _mock_connection(conn_id="uuid-1", display_name="Dev PostgreSQL")
        session = _mock_session_returning_one(conn)
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.get("/api/databases/uuid-1")

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "uuid-1"
        assert data["database_name"] == "Dev PostgreSQL"

    def test_get_database_not_found(self):
        """GET /api/databases/{id} returns 404 for non-existent ID."""
        app = _create_test_app()
        session = _mock_session_returning_one(None)
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.get("/api/databases/nonexistent")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Test 3: POST /api/databases creates connection with encrypted password
# ---------------------------------------------------------------------------


class TestCreateDatabase:
    def test_create_database(self):
        """POST /api/databases creates connection with encrypted password, returns 201."""
        app = _create_test_app()
        session = _mock_session_returning_one(None)  # session for flush
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.post("/api/databases", json={
            "databaseName": "New DB",
            "backend": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "test_db",
            "username": "admin",
            "password": "secret",
        })

        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert isinstance(data["id"], str)
        assert data["database_name"] == "New DB"
        assert data["backend"] == "postgresql"
        assert data["status"] == "untested"
        # Verify encryption was called
        assert app.state.encryption.encrypt.called
        # Verify resolver was invalidated
        assert app.state.connection_resolver.invalidate.called

    def test_create_database_duplicate_name(self):
        """POST /api/databases with duplicate name returns 409."""
        from sqlalchemy.exc import IntegrityError

        app = _create_test_app()
        session = _mock_session_returning_one(None)
        session.flush = AsyncMock(side_effect=IntegrityError("mock", {}, Exception("UNIQUE constraint")))
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.post("/api/databases", json={
            "databaseName": "Existing DB",
            "backend": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "test_db",
            "username": "admin",
            "password": "secret",
        })

        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Test 4: PUT /api/databases/{id} updates connection
# ---------------------------------------------------------------------------


class TestUpdateDatabase:
    def test_update_database(self):
        """PUT /api/databases/{id} updates fields, disposes engine, invalidates resolver."""
        app = _create_test_app()
        conn = _mock_connection(conn_id="uuid-1")
        session = _mock_session_returning_one(conn)
        mgr = _mock_engine_manager()
        _override_deps(app, session=session, engine_manager=mgr)

        client = TestClient(app)
        resp = client.put("/api/databases/uuid-1", json={
            "databaseName": "Updated DB",
            "host": "newhost",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "uuid-1"
        # Engine should be disposed
        mgr.dispose_engine.assert_called_once_with("uuid-1")
        # Resolver should be invalidated
        assert app.state.connection_resolver.invalidate.called

    def test_update_database_not_found(self):
        """PUT /api/databases/{id} with non-existent ID returns 404."""
        app = _create_test_app()
        session = _mock_session_returning_one(None)
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.put("/api/databases/nonexistent", json={
            "databaseName": "Updated DB",
        })

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Test 5: DELETE /api/databases/{id} removes connection
# ---------------------------------------------------------------------------


class TestDeleteDatabase:
    def test_delete_database(self):
        """DELETE /api/databases/{id} removes connection, disposes engine."""
        app = _create_test_app()
        conn = _mock_connection(conn_id="uuid-1")
        session = _mock_session_returning_one(conn)
        mgr = _mock_engine_manager()
        _override_deps(app, session=session, engine_manager=mgr)

        client = TestClient(app)
        resp = client.delete("/api/databases/uuid-1")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        # Engine should be disposed
        mgr.dispose_engine.assert_called_once_with("uuid-1")
        # Session.delete should have been called
        session.delete.assert_called_once()
        # Resolver should be invalidated
        assert app.state.connection_resolver.invalidate.called

    def test_delete_database_not_found(self):
        """DELETE /api/databases/{id} with non-existent ID returns 404."""
        app = _create_test_app()
        session = _mock_session_returning_one(None)
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.delete("/api/databases/nonexistent")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Test 6: POST /api/databases/test tests connectivity
# ---------------------------------------------------------------------------


class TestTestConnection:
    def test_test_connection_success(self):
        """POST /api/databases/test with successful connection returns success."""
        app = _create_test_app()
        _override_deps(app, session=_mock_session_returning_one(None), engine_manager=_mock_engine_manager())

        with patch("app.api.databases.EngineManager.test_connection", new_callable=AsyncMock) as mock_test:
            mock_test.return_value = (True, "Connection successful")
            client = TestClient(app)
            resp = client.post("/api/databases/test", json={
                "backend": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "test_db",
                "username": "admin",
                "password": "secret",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["message"] == "Connection successful"

    def test_test_connection_failure(self):
        """POST /api/databases/test with failed connection returns failure."""
        app = _create_test_app()
        _override_deps(app, session=_mock_session_returning_one(None), engine_manager=_mock_engine_manager())

        with patch("app.api.databases.EngineManager.test_connection", new_callable=AsyncMock) as mock_test:
            mock_test.return_value = (False, "Connection refused")
            client = TestClient(app)
            resp = client.post("/api/databases/test", json={
                "backend": "postgresql",
                "host": "badhost",
                "port": 5432,
                "database": "test_db",
                "username": "admin",
                "password": "secret",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "Connection refused" in data["message"]


# ---------------------------------------------------------------------------
# Test 7: GET /api/databases/{id}/datasets returns datasets
# ---------------------------------------------------------------------------


class TestListDatabaseDatasets:
    def test_list_database_datasets(self):
        """GET /api/databases/{id}/datasets returns paginated datasets."""
        app = _create_test_app()

        # Mock datasets
        ds1 = MagicMock()
        ds1.id = "ds-1"
        ds1.name = "aging_data"
        ds1.columns = [{"name": "col1"}, {"name": "col2"}]
        ds2 = MagicMock()
        ds2.id = "ds-2"
        ds2.name = "match_data"
        ds2.columns = [{"name": "col1"}]

        session = _mock_session_returning_list([ds1, ds2])
        _override_deps(app, session=session, engine_manager=_mock_engine_manager())

        client = TestClient(app)
        resp = client.get("/api/databases/uuid-1/datasets")

        assert resp.status_code == 200
        data = resp.json()
        assert "datasets" in data
        assert "total" in data
        assert data["total"] == 2
        assert len(data["datasets"]) == 2


# ---------------------------------------------------------------------------
# Test 8: No Superset imports in databases.py
# ---------------------------------------------------------------------------


class TestNoSupersetImports:
    def test_no_superset_imports(self):
        """databases.py has no imports of SupersetClient, SupersetDep, or httpx."""
        import app.api.databases as db_mod

        source = inspect.getsource(db_mod)
        assert "SupersetClient" not in source
        assert "SupersetDep" not in source
        assert "import httpx" not in source
