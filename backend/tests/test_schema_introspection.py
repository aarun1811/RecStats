"""Tests for schema introspection endpoints (Unit 3a)."""

from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection


@pytest.fixture
def sqlite_session():
    """In-memory SQLite session using the ORM models."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _make_connection(
    session: Session,
    *,
    backend: str = "oracle",
    schema_name: str | None = None,
    conn_id: str = "test-uuid-1",
) -> RecvizConnection:
    """Create and persist a RecvizConnection row for tests.

    Defaults match the Oracle profile (backwards compatible with the prior
    `_make_oracle_connection` helper). Pass `backend='postgresql'` to build
    a Postgres-shaped connection instead.
    """
    if backend == "oracle":
        defaults = dict(host="oracle.local", port=1521, database_name="ORCL")
        default_schema = "TEST"
    elif backend == "postgresql":
        defaults = dict(host="postgres.local", port=5432, database_name="recviz")
        default_schema = "public"
    else:
        raise ValueError(f"Unsupported test backend: {backend}")

    conn = RecvizConnection(
        id=conn_id,
        name="test_conn",
        display_name="Test Connection",
        backend=backend,
        username="test",
        encrypted_password="encrypted-placeholder",
        schema_name=schema_name if schema_name is not None else default_schema,
        status="untested",
        **defaults,
    )
    session.add(conn)
    session.commit()
    return conn


def _make_oracle_connection(
    session: Session,
    *,
    schema_name: str = "TEST",
    conn_id: str = "test-uuid-1",
) -> RecvizConnection:
    """Backwards-compatible alias used by existing Oracle tests."""
    return _make_connection(
        session,
        backend="oracle",
        schema_name=schema_name,
        conn_id=conn_id,
    )


def _mock_engine_manager(rows=None, raise_exc: Exception | None = None) -> MagicMock:
    """Build a mock EngineManager whose engine.connect() yields a conn that
    returns `rows` from execute().fetchall(), or raises `raise_exc` from execute().
    """
    engine = MagicMock()
    db_conn = MagicMock()

    if raise_exc is not None:
        db_conn.execute.side_effect = raise_exc
    else:
        result = MagicMock()
        result.fetchall.return_value = rows or []
        db_conn.execute.return_value = result

    @contextmanager
    def _cm():
        yield db_conn

    engine.connect = _cm

    em = MagicMock()
    em.get_engine_for_connection.return_value = engine
    return em


def test_table_name_regex_rejects_injection():
    """The table_name validator should reject SQL injection attempts."""
    from app.api.databases import TABLE_NAME_RE

    assert TABLE_NAME_RE.match("ITEMS") is not None
    assert TABLE_NAME_RE.match("message_feed") is not None
    assert TABLE_NAME_RE.match("TBL$1") is not None    # Oracle allows $
    assert TABLE_NAME_RE.match("T_123") is not None

    # Bad ones
    assert TABLE_NAME_RE.match("1_LEADING_DIGIT") is None
    assert TABLE_NAME_RE.match("DROP TABLE") is None
    assert TABLE_NAME_RE.match("ITEMS; SELECT 1") is None
    assert TABLE_NAME_RE.match("ITEMS'--") is None
    assert TABLE_NAME_RE.match("") is None
    assert TABLE_NAME_RE.match("A" * 31) is None       # too long (max 30)


def test_nullable_normalization():
    """nullable values from Oracle and Postgres should normalize to bool."""
    from app.api.databases import _normalize_nullable

    # Oracle returns 'Y' / 'N' — test both so a broken predicate like
    # `raw in ("Y", "YES", "N")` would be caught
    assert _normalize_nullable("Y") is True
    assert _normalize_nullable("N") is False

    # Postgres information_schema returns 'YES' / 'NO'
    assert _normalize_nullable("YES") is True
    assert _normalize_nullable("NO") is False

    # Case-insensitive
    assert _normalize_nullable("y") is True
    assert _normalize_nullable("n") is False

    # Unknown values default to True (permissive)
    assert _normalize_nullable(None) is True
    assert _normalize_nullable("") is True
    assert _normalize_nullable("maybe") is True


# ---------------------------------------------------------------------------
# Endpoint-level tests (spec section 7.2)
# ---------------------------------------------------------------------------


def test_list_tables_returns_oracle_shape(sqlite_session: Session):
    """GET /tables against an Oracle mock should return [{name, type}]."""
    from app.api.databases import list_schema_tables

    conn = _make_oracle_connection(sqlite_session)
    em = _mock_engine_manager(
        rows=[("ITEMS", "TABLE"), ("V_REPORT", "VIEW")]
    )

    result = list_schema_tables(
        db_id=conn.id,
        session=sqlite_session,
        engine_manager=em,
    )

    assert result == [
        {"name": "ITEMS", "type": "TABLE"},
        {"name": "V_REPORT", "type": "VIEW"},
    ]
    em.get_engine_for_connection.assert_called_once_with(conn)


def test_list_tables_missing_schema_name_returns_400(sqlite_session: Session):
    """A connection with empty schema_name should yield a 400 from /tables."""
    from app.api.databases import list_schema_tables

    conn = _make_oracle_connection(sqlite_session, schema_name="")
    em = _mock_engine_manager(rows=[])

    with pytest.raises(HTTPException) as excinfo:
        list_schema_tables(
            db_id=conn.id,
            session=sqlite_session,
            engine_manager=em,
        )
    assert excinfo.value.status_code == 400
    # Should not even try to create an engine — schema check happens first
    em.get_engine_for_connection.assert_not_called()


def test_list_columns_invalid_table_name_returns_400(sqlite_session: Session):
    """An invalid table_name should be rejected by the regex with a 400."""
    from app.api.databases import list_table_columns

    conn = _make_oracle_connection(sqlite_session)
    em = _mock_engine_manager(rows=[])

    with pytest.raises(HTTPException) as excinfo:
        list_table_columns(
            db_id=conn.id,
            table_name="DROP TABLE ITEMS",
            session=sqlite_session,
            engine_manager=em,
        )
    assert excinfo.value.status_code == 400
    assert "Invalid table name" in str(excinfo.value.detail)
    # Regex check happens before any DB lookup
    em.get_engine_for_connection.assert_not_called()


def test_list_columns_returns_oracle_shape_with_normalized_nullable(
    sqlite_session: Session,
):
    """GET /columns against an Oracle mock should return [{name, type, nullable}]
    with the Y/N nullable flag normalized to a Python bool."""
    from app.api.databases import list_table_columns

    conn = _make_oracle_connection(sqlite_session)
    em = _mock_engine_manager(
        rows=[("ID", "NUMBER", "N"), ("NAME", "VARCHAR2", "Y")]
    )

    result = list_table_columns(
        db_id=conn.id,
        table_name="ITEMS",
        session=sqlite_session,
        engine_manager=em,
    )

    assert result == [
        {"name": "ID", "type": "NUMBER", "nullable": False},
        {"name": "NAME", "type": "VARCHAR2", "nullable": True},
    ]
    em.get_engine_for_connection.assert_called_once_with(conn)


def test_list_tables_introspection_error_returns_503(sqlite_session: Session):
    """If the introspection SQL raises, the endpoint should return 503 with
    a sanitized detail message."""
    from app.api.databases import list_schema_tables

    conn = _make_oracle_connection(sqlite_session)
    em = _mock_engine_manager(
        raise_exc=RuntimeError("ORA-00942: table or view does not exist")
    )

    with pytest.raises(HTTPException) as excinfo:
        list_schema_tables(
            db_id=conn.id,
            session=sqlite_session,
            engine_manager=em,
        )
    assert excinfo.value.status_code == 503
    assert "Failed to query schema catalog" in str(excinfo.value.detail)


def test_list_tables_postgres_normalizes_base_table_to_table(
    sqlite_session: Session,
):
    """Postgres' information_schema.tables emits 'BASE TABLE' for tables and
    'VIEW' for views. The endpoint should normalize 'BASE TABLE' -> 'TABLE'
    while leaving 'VIEW' alone."""
    from app.api.databases import list_schema_tables

    conn = _make_connection(sqlite_session, backend="postgresql")
    em = _mock_engine_manager(
        rows=[("items", "BASE TABLE"), ("v_summary", "VIEW")]
    )

    result = list_schema_tables(
        db_id=conn.id,
        session=sqlite_session,
        engine_manager=em,
    )

    assert result == [
        {"name": "items", "type": "TABLE"},
        {"name": "v_summary", "type": "VIEW"},
    ]
    em.get_engine_for_connection.assert_called_once_with(conn)


def test_list_columns_postgres_normalizes_yes_no_nullable(
    sqlite_session: Session,
):
    """Postgres' information_schema.columns.is_nullable returns 'YES'/'NO'
    strings. The endpoint should normalize them to Python bools."""
    from app.api.databases import list_table_columns

    conn = _make_connection(sqlite_session, backend="postgresql")
    em = _mock_engine_manager(
        rows=[("id", "integer", "NO"), ("name", "text", "YES")]
    )

    result = list_table_columns(
        db_id=conn.id,
        table_name="items",
        session=sqlite_session,
        engine_manager=em,
    )

    assert result == [
        {"name": "id", "type": "integer", "nullable": False},
        {"name": "name", "type": "text", "nullable": True},
    ]
    em.get_engine_for_connection.assert_called_once_with(conn)
