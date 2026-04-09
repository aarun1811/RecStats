"""Unit tests for URI builder — Oracle, Hive, PostgreSQL dialects + async URIs."""

import pytest

from app.services.uri_builder import build_async_uri, build_sqlalchemy_uri


def test_oracle_full_uri():
    """Oracle with all fields uses oracle:// dialect and service_name param."""
    result = build_sqlalchemy_uri(
        "oracle", host="orahost", port=1521, database="MYSERVICE",
        username="user", password="pass",
    )
    assert result == "oracle://user:pass@orahost:1521/?service_name=MYSERVICE"


def test_oracle_no_credentials():
    """Oracle without username/password omits user part."""
    result = build_sqlalchemy_uri(
        "oracle", host="orahost", database="SVC",
    )
    assert result == "oracle://orahost:1521/?service_name=SVC"


def test_hive_basic_uri():
    """Hive with host, port, and database."""
    result = build_sqlalchemy_uri(
        "hive", host="hivehost", port=10000, database="default",
    )
    assert result == "hive://hivehost:10000/default"


def test_hive_with_username():
    """Hive with username (empty password)."""
    result = build_sqlalchemy_uri(
        "hive", host="hivehost", username="huser",
    )
    assert result == "hive://huser:@hivehost:10000/default"


def test_postgresql_full_uri():
    """PostgreSQL with all fields."""
    result = build_sqlalchemy_uri(
        "postgresql", host="pghost", database="mydb",
        username="u", password="p",
    )
    assert result == "postgresql://u:p@pghost:5432/mydb"


def test_oracle_special_chars_in_password():
    """Oracle password with special chars is URL-encoded."""
    result = build_sqlalchemy_uri(
        "oracle", host="orahost", database="SVC",
        username="admin", password="p@ss/w0rd",
    )
    assert "p%40ss%2Fw0rd" in result
    assert result.startswith("oracle://")


# --- Async URI builder tests ---


def test_async_postgresql_uri():
    """Async PostgreSQL uses postgresql+asyncpg:// dialect."""
    result = build_async_uri(
        "postgresql", host="pghost", port=5432, database="mydb",
        username="u", password="p",
    )
    assert result == "postgresql+asyncpg://u:p@pghost:5432/mydb"


def test_async_oracle_uri():
    """Async Oracle uses oracle+oracledb:// dialect with service_name."""
    result = build_async_uri(
        "oracle", host="orahost", port=1521, database="MYSERVICE",
        username="u", password="p",
    )
    assert result == "oracle+oracledb://u:p@orahost:1521/?service_name=MYSERVICE"


def test_async_oracle_special_chars():
    """Async Oracle password with special chars is URL-encoded."""
    result = build_async_uri(
        "oracle", host="orahost", database="SVC",
        username="admin", password="p@ss/w0rd",
    )
    assert "p%40ss%2Fw0rd" in result
    assert result.startswith("oracle+oracledb://")


def test_async_unsupported_backend():
    """Async URI with unsupported backend raises ValueError."""
    with pytest.raises(ValueError, match="Unsupported async backend"):
        build_async_uri("hive", host="hivehost", database="default")


def test_async_default_port_postgresql():
    """Async PostgreSQL without port defaults to 5432."""
    result = build_async_uri(
        "postgresql", host="pghost", database="mydb",
        username="u", password="p",
    )
    assert ":5432/" in result


def test_async_default_port_oracle():
    """Async Oracle without port defaults to 1521."""
    result = build_async_uri(
        "oracle", host="orahost", database="SVC",
        username="u", password="p",
    )
    assert ":1521/" in result
