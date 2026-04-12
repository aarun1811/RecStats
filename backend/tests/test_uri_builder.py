"""Unit tests for URI builder -- Oracle dialect + sync URIs."""

import pytest

from app.services.uri_builder import build_sqlalchemy_uri, build_sync_uri


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


def test_oracle_special_chars_in_password():
    """Oracle password with special chars is URL-encoded."""
    result = build_sqlalchemy_uri(
        "oracle", host="orahost", database="SVC",
        username="admin", password="p@ss/w0rd",
    )
    assert "p%40ss%2Fw0rd" in result
    assert result.startswith("oracle://")


def test_unsupported_backend():
    """Unsupported backend raises ValueError."""
    with pytest.raises(ValueError, match="Unsupported backend"):
        build_sqlalchemy_uri("hive", host="hivehost", database="default")


# --- Sync URI builder tests ---


def test_sync_oracle_uri():
    """Sync Oracle uses oracle+oracledb:// dialect with service_name."""
    result = build_sync_uri(
        "oracle", host="orahost", port=1521, database="MYSERVICE",
        username="u", password="p",
    )
    assert result == "oracle+oracledb://u:p@orahost:1521/?service_name=MYSERVICE"


def test_sync_oracle_special_chars():
    """Sync Oracle password with special chars is URL-encoded."""
    result = build_sync_uri(
        "oracle", host="orahost", database="SVC",
        username="admin", password="p@ss/w0rd",
    )
    assert "p%40ss%2Fw0rd" in result
    assert result.startswith("oracle+oracledb://")


def test_sync_unsupported_backend():
    """Sync URI with unsupported backend raises ValueError."""
    with pytest.raises(ValueError, match="Unsupported sync backend"):
        build_sync_uri("hive", host="hivehost", database="default")


def test_sync_default_port_oracle():
    """Sync Oracle without port defaults to 1521."""
    result = build_sync_uri(
        "oracle", host="orahost", database="SVC",
        username="u", password="p",
    )
    assert ":1521/" in result
