"""Build SQLAlchemy URIs for Oracle connections."""

from __future__ import annotations

from urllib.parse import quote_plus

DEFAULT_PORTS: dict[str, int] = {
    "oracle": 1521,
}

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
    """Build a sync-compatible SQLAlchemy URI for Oracle.

    Oracle: oracle+oracledb://user:pass@host:port/?service_name=SID
    """
    if backend != "oracle":
        raise ValueError(
            f"Unsupported backend: {backend}. Only 'oracle' is supported."
        )

    port = port or DEFAULT_PORTS["oracle"]
    user_part = ""
    if username:
        encoded_pass = quote_plus(password) if password else ""
        user_part = f"{quote_plus(username)}:{encoded_pass}@"

    service_name = database or "ORCL"
    return f"oracle+oracledb://{user_part}{host}:{port}/?service_name={service_name}"
