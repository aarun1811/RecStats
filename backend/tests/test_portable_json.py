"""Tests for OracleJSON (PortableJSON) TypeDecorator -- BLOB IS JSON on Oracle 19c."""

import json

import sqlalchemy as sa
from sqlalchemy.dialects import oracle
from sqlalchemy.schema import CreateTable

from app.db.types import OracleJSON, PortableJSON


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_test_table() -> sa.Table:
    """Create a minimal SA Table with an OracleJSON column for DDL tests."""
    metadata = sa.MetaData()
    return sa.Table(
        "test_tbl",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("data", OracleJSON()),
    )


class _MockDialect:
    """Minimal mock dialect for process_bind_param / process_result_value tests."""

    def __init__(self, name: str) -> None:
        self.name = name


# ---------------------------------------------------------------------------
# DDL compilation tests
# ---------------------------------------------------------------------------

def test_oracle_ddl_compiles_to_blob():
    """OracleJSON should compile to BLOB in Oracle DDL."""
    table = _make_test_table()
    ddl = CreateTable(table).compile(dialect=oracle.dialect())
    ddl_str = str(ddl)
    assert "BLOB" in ddl_str, f"Expected BLOB in DDL, got: {ddl_str}"


# ---------------------------------------------------------------------------
# process_bind_param tests
# ---------------------------------------------------------------------------

def test_process_bind_param_serializes_to_bytes():
    """process_bind_param should JSON-serialize the value to UTF-8 bytes."""
    pj = OracleJSON()
    dialect = _MockDialect("oracle")
    value = {"key": "value", "count": 42}
    result = pj.process_bind_param(value, dialect)
    assert isinstance(result, bytes)
    assert json.loads(result.decode("utf-8")) == value


def test_process_bind_param_none_returns_none():
    """process_bind_param should return None when value is None."""
    pj = OracleJSON()
    dialect = _MockDialect("oracle")
    result = pj.process_bind_param(None, dialect)
    assert result is None


# ---------------------------------------------------------------------------
# process_result_value tests
# ---------------------------------------------------------------------------

def test_process_result_value_deserializes_bytes():
    """process_result_value should JSON-deserialize bytes values."""
    pj = OracleJSON()
    dialect = _MockDialect("oracle")
    raw = b'{"key": "value", "count": 42}'
    result = pj.process_result_value(raw, dialect)
    assert result == {"key": "value", "count": 42}


def test_process_result_value_deserializes_string():
    """process_result_value should JSON-deserialize string values."""
    pj = OracleJSON()
    dialect = _MockDialect("oracle")
    raw = '{"key": "value", "count": 42}'
    result = pj.process_result_value(raw, dialect)
    assert result == {"key": "value", "count": 42}


def test_process_result_value_none_returns_none():
    """process_result_value should return None when value is None."""
    pj = OracleJSON()
    dialect = _MockDialect("oracle")
    result = pj.process_result_value(None, dialect)
    assert result is None


# ---------------------------------------------------------------------------
# Alias + cache_ok
# ---------------------------------------------------------------------------

def test_portable_json_is_alias():
    """PortableJSON is a grace alias for OracleJSON."""
    assert PortableJSON is OracleJSON


def test_cache_ok_is_true():
    """OracleJSON must have cache_ok = True for SQLAlchemy query caching."""
    assert OracleJSON.cache_ok is True
