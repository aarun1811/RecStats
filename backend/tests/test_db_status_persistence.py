"""Tests for persistent connection status in recviz_connections (Unit 2).

These tests are distinct from `test_connection_status.py`, which covers
the in-memory `ConnectionStatusTracker`. This file covers the DB column
persistence added in Unit 2."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection


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
