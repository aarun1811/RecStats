"""Build SQLAlchemy URIs from individual connection fields."""

from __future__ import annotations

from urllib.parse import quote_plus

# Default ports per backend
DEFAULT_PORTS: dict[str, int] = {
    "oracle": 1521,
}


def build_sqlalchemy_uri(
    backend: str,
    host: str | None = None,
    port: int | None = None,
    database: str | None = None,
    username: str | None = None,
    password: str | None = None,
    schema_name: str | None = None,
) -> str:
    """Construct a SQLAlchemy URI from individual fields.

    If any required field is missing, raises ValueError.
    """
    if not host:
        raise ValueError("host is required")

    port = port or DEFAULT_PORTS.get(backend, 1521)
    user_part = ""
    if username:
        encoded_pass = quote_plus(password) if password else ""
        user_part = f"{quote_plus(username)}:{encoded_pass}@"

    if backend == "oracle":
        db_part = database or "ORCL"
        return f"oracle://{user_part}{host}:{port}/?service_name={db_part}"

    raise ValueError(f"Unsupported backend: {backend}")


# Sync dialect prefixes for create_engine
SYNC_DIALECTS: dict[str, str] = {
    "oracle": "oracle+oracledb",
}


def build_sync_uri(
    backend: str,
    host: str,
    port: int | None = None,
    database: str | None = None,
    username: str | None = None,
    password: str | None = None,
) -> str:
    """Build a sync-compatible SQLAlchemy URI for create_engine.

    Oracle: oracle+oracledb://user:pass@host:port/?service_name=SID
    """
    dialect_prefix = SYNC_DIALECTS.get(backend)
    if dialect_prefix is None:
        raise ValueError(
            f"Unsupported sync backend: {backend}. "
            f"Supported: {list(SYNC_DIALECTS.keys())}"
        )

    port = port or DEFAULT_PORTS.get(backend, 1521)
    user_part = ""
    if username:
        encoded_pass = quote_plus(password) if password else ""
        user_part = f"{quote_plus(username)}:{encoded_pass}@"

    if backend == "oracle":
        service_name = database or "ORCL"
        return f"{dialect_prefix}://{user_part}{host}:{port}/?service_name={service_name}"

    # Should not reach here due to SYNC_DIALECTS check above
    raise ValueError(f"Unsupported backend: {backend}")
