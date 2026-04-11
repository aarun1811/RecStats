"""Tests for persistent connection status in recviz_connections (Unit 2).

These tests are distinct from `test_connection_status.py`, which covers
the in-memory `ConnectionStatusTracker`. This file covers the DB column
persistence added in Unit 2."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection
from app.services.encryption import EncryptionService


@pytest.fixture
def sqlite_session():
    """In-memory SQLite session using the ORM models (PortableJSON falls back to TEXT)."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _make_connection(session: Session, name: str = "test_conn") -> RecvizConnection:
    conn = RecvizConnection(
        id="test-uuid-1",
        name=name,
        display_name="Test Connection",
        backend="oracle",
        host="oracle.local",
        port=1521,
        database_name="ORCL",
        username="test",
        encrypted_password="encrypted-placeholder",
        schema_name="TEST",
        status="untested",
    )
    session.add(conn)
    session.commit()
    return conn


def test_persist_status_on_successful_test(sqlite_session: Session):
    """After a successful test, the DB row should have status='connected' and last_tested_at."""
    conn = _make_connection(sqlite_session)
    conn.status = "connected"
    conn.last_tested_at = datetime.now(timezone.utc)
    sqlite_session.commit()

    reloaded = sqlite_session.get(RecvizConnection, "test-uuid-1")
    assert reloaded is not None
    assert reloaded.status == "connected"
    assert reloaded.last_tested_at is not None


def test_persist_status_on_failed_test(sqlite_session: Session):
    """After a failed test, the DB row should have status='unreachable'."""
    conn = _make_connection(sqlite_session)
    conn.status = "unreachable"
    conn.last_tested_at = datetime.now(timezone.utc)
    sqlite_session.commit()

    reloaded = sqlite_session.get(RecvizConnection, "test-uuid-1")
    assert reloaded.status == "unreachable"


def test_build_response_reads_from_db_column(sqlite_session: Session):
    """_build_response should read status from the DB row, not an in-memory tracker."""
    from app.api.databases import _build_response

    conn = _make_connection(sqlite_session)
    conn.status = "connected"
    test_time = datetime.now(timezone.utc)
    conn.last_tested_at = test_time
    sqlite_session.commit()

    response = _build_response(conn)
    assert response["status"] == "connected"
    # Compare against the (possibly tz-stripped on SQLite) reloaded value, not
    # the original; production stores TIMESTAMPTZ so the round-trip preserves
    # the offset.
    assert response["last_tested"] == conn.last_tested_at.isoformat()
    assert response["last_tested"] is not None


def test_build_response_untested_default(sqlite_session: Session):
    """Fresh connection without any test still has status='untested'."""
    from app.api.databases import _build_response

    conn = _make_connection(sqlite_session)
    response = _build_response(conn)
    assert response["status"] == "untested"
    assert response["last_tested"] is None


def _mock_request(encryption: EncryptionService) -> SimpleNamespace:
    """Minimal Request stand-in exposing only what create_database reads."""
    return SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                encryption=encryption,
                connection_resolver=None,
            )
        )
    )


def test_create_database_persists_connected_on_auto_test_success(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """create_database should auto-test after flush and persist status='connected'.

    This is the real integration surface added in Unit 2: we patch
    EngineManager.test_connection to return success and verify the row
    created by create_database has status='connected' + last_tested_at set.
    """
    from app.api import databases as databases_api
    from app.models.database import DatabaseCreate

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(lambda uri, backend, timeout=10: (True, "ok")),
    )

    encryption = EncryptionService(EncryptionService.generate_key())
    body = DatabaseCreate(
        databaseName="TestOra",
        backend="oracle",
        host="oracle.local",
        port=1521,
        database="ORCL",
        schemaName="TEST",
        username="test",
        password="secret",
    )

    response = databases_api.create_database(
        body=body,
        session=sqlite_session,
        engine_manager=None,  # not used by create_database beyond type hint
        request=_mock_request(encryption),  # type: ignore[arg-type]
    )

    assert response["status"] == "connected"
    assert response["last_tested"] is not None

    # Row should actually be in the DB with matching status
    stored = sqlite_session.execute(
        select(RecvizConnection).where(RecvizConnection.display_name == "TestOra")
    ).scalar_one()
    assert stored.status == "connected"
    assert stored.last_tested_at is not None


def test_create_database_persists_unreachable_on_auto_test_failure(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """When the auto-test raises, create_database still succeeds but persists unreachable."""
    from app.api import databases as databases_api
    from app.models.database import DatabaseCreate

    def _raising_test(uri, backend, timeout=10):
        raise RuntimeError("ORA-12541: no listener")

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_raising_test),
    )

    encryption = EncryptionService(EncryptionService.generate_key())
    body = DatabaseCreate(
        databaseName="BrokenOra",
        backend="oracle",
        host="nowhere",
        port=1521,
        database="ORCL",
        schemaName="TEST",
        username="test",
        password="secret",
    )

    response = databases_api.create_database(
        body=body,
        session=sqlite_session,
        engine_manager=None,
        request=_mock_request(encryption),  # type: ignore[arg-type]
    )

    assert response["status"] == "unreachable"
    assert response["last_tested"] is not None
