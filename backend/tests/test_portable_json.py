"""Tests for PortableJSON TypeDecorator -- cross-dialect JSONB/CLOB portability."""

import json

import sqlalchemy as sa
from sqlalchemy.dialects import oracle, postgresql
from sqlalchemy.schema import CreateTable

from app.db.types import PortableJSON


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_test_table() -> sa.Table:
    """Create a minimal SA Table with a PortableJSON column for DDL tests."""
    metadata = sa.MetaData()
    return sa.Table(
        "test_tbl",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("data", PortableJSON()),
    )


class _MockDialect:
    """Minimal mock dialect for process_bind_param / process_result_value tests."""

    def __init__(self, name: str) -> None:
        self.name = name


# ---------------------------------------------------------------------------
# DDL compilation tests
# ---------------------------------------------------------------------------

def test_postgresql_ddl_compiles_to_jsonb():
    """PortableJSON should compile to JSONB in PostgreSQL DDL."""
    table = _make_test_table()
    ddl = CreateTable(table).compile(dialect=postgresql.dialect())
    ddl_str = str(ddl)
    assert "JSONB" in ddl_str, f"Expected JSONB in DDL, got: {ddl_str}"


def test_oracle_ddl_compiles_to_clob():
    """PortableJSON should compile to CLOB in Oracle DDL."""
    table = _make_test_table()
    ddl = CreateTable(table).compile(dialect=oracle.dialect())
    ddl_str = str(ddl)
    assert "CLOB" in ddl_str, f"Expected CLOB in DDL, got: {ddl_str}"


# ---------------------------------------------------------------------------
# process_bind_param tests
# ---------------------------------------------------------------------------

def test_process_bind_param_serializes_for_oracle():
    """On non-PG dialects, process_bind_param should JSON-serialize the value."""
    pj = PortableJSON()
    dialect = _MockDialect("oracle")
    value = {"key": "value", "count": 42}
    result = pj.process_bind_param(value, dialect)
    assert isinstance(result, str)
    assert json.loads(result) == value


def test_process_bind_param_passthrough_for_postgresql():
    """On PostgreSQL, process_bind_param should return value unchanged."""
    pj = PortableJSON()
    dialect = _MockDialect("postgresql")
    value = {"key": "value", "count": 42}
    result = pj.process_bind_param(value, dialect)
    assert result is value  # identity check -- same object, not serialized


def test_process_bind_param_none_returns_none():
    """process_bind_param should return None when value is None, regardless of dialect."""
    pj = PortableJSON()
    for dialect_name in ("oracle", "postgresql"):
        dialect = _MockDialect(dialect_name)
        result = pj.process_bind_param(None, dialect)
        assert result is None, f"Expected None for dialect={dialect_name}"


# ---------------------------------------------------------------------------
# process_result_value tests
# ---------------------------------------------------------------------------

def test_process_result_value_deserializes_for_oracle():
    """On non-PG dialects, process_result_value should JSON-deserialize string values."""
    pj = PortableJSON()
    dialect = _MockDialect("oracle")
    raw = '{"key": "value", "count": 42}'
    result = pj.process_result_value(raw, dialect)
    assert result == {"key": "value", "count": 42}


def test_process_result_value_passthrough_for_postgresql():
    """On PostgreSQL, process_result_value should return value unchanged."""
    pj = PortableJSON()
    dialect = _MockDialect("postgresql")
    value = {"key": "value", "count": 42}
    result = pj.process_result_value(value, dialect)
    assert result is value


def test_process_result_value_none_returns_none():
    """process_result_value should return None when value is None, regardless of dialect."""
    pj = PortableJSON()
    for dialect_name in ("oracle", "postgresql"):
        dialect = _MockDialect(dialect_name)
        result = pj.process_result_value(None, dialect)
        assert result is None, f"Expected None for dialect={dialect_name}"


# ---------------------------------------------------------------------------
# cache_ok flag
# ---------------------------------------------------------------------------

def test_cache_ok_is_true():
    """PortableJSON must have cache_ok = True for SQLAlchemy query caching."""
    assert PortableJSON.cache_ok is True
