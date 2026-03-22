"""Build SQLAlchemy URIs from individual connection fields."""

from __future__ import annotations

from urllib.parse import quote_plus

# Default ports per backend
DEFAULT_PORTS: dict[str, int] = {
    "oracle": 1521,
    "postgresql": 5432,
    "hive": 10000,
    "elasticsearch": 9200,
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

    port = port or DEFAULT_PORTS.get(backend, 5432)
    user_part = ""
    if username:
        encoded_pass = quote_plus(password) if password else ""
        user_part = f"{quote_plus(username)}:{encoded_pass}@"

    if backend == "oracle":
        db_part = database or "ORCL"
        return f"oracle+cx_oracle://{user_part}{host}:{port}/?service_name={db_part}"

    if backend == "postgresql":
        db_part = database or "postgres"
        return f"postgresql://{user_part}{host}:{port}/{db_part}"

    if backend == "hive":
        db_part = database or "default"
        return f"hive://{user_part}{host}:{port}/{db_part}"

    if backend == "elasticsearch":
        scheme = "https" if port == 443 else "http"
        return f"elasticsearch+{scheme}://{host}:{port}/"

    raise ValueError(f"Unsupported backend: {backend}")
