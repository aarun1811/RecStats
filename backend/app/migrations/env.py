"""Alembic migration environment for Oracle.

Thick mode must be initialized before creating engines. The URL comes from
Settings (RECVIZ_DB_URL env var), not alembic.ini.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

import oracledb
from alembic import context
from sqlalchemy import create_engine

from app.config import settings
from app.db.base import Base

# Import all models so they register with Base.metadata
from app.db.models import (  # noqa: F401
    RecvizChart,
    RecvizConnection,
    RecvizDashboard,
    RecvizDataSource,
    RecvizDataset,
    RecvizKpi,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _ensure_thick_mode() -> None:
    """Initialize Oracle thick mode if not already done.

    When running via `alembic upgrade head` directly (not through the app),
    thick mode may not be initialized yet. Safe to call multiple times --
    oracledb raises if already initialized, which we catch.
    """
    lib_dir = os.environ.get("ORACLE_CLIENT_LIB_DIR", "").strip()
    if not lib_dir:
        raise RuntimeError(
            "FATAL: ORACLE_CLIENT_LIB_DIR is not set. "
            "Cannot run Alembic migrations without Oracle Instant Client."
        )
    try:
        oracledb.init_oracle_client(lib_dir=lib_dir)
    except Exception:
        pass  # Already initialized (e.g., when running inside the app)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL without connecting)."""
    url = settings.recviz_db_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table="recviz_alembic_version",
        compare_type=True,
        compare_server_default=True,
        include_schemas=False,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with a sync Oracle engine."""
    _ensure_thick_mode()

    connectable = create_engine(
        settings.recviz_db_url,
        pool_size=2,
        max_overflow=0,
        pool_pre_ping=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table="recviz_alembic_version",
            compare_type=True,
            compare_server_default=True,
            include_schemas=False,
            transaction_per_migration=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
