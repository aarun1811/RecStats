from __future__ import annotations

from typing import Any, Callable

CURRENT_SCHEMA_VERSION = 1

MigrationFunc = Callable[[dict[str, Any]], dict[str, Any]]

_migrations: dict[int, MigrationFunc] = {}


def register_migration(from_version: int):
    """Register a migration function that upgrades config from `from_version` to `from_version + 1`."""

    def decorator(fn: MigrationFunc) -> MigrationFunc:
        _migrations[from_version] = fn
        return fn

    return decorator


def migrate_config(config: dict[str, Any]) -> dict[str, Any]:
    """Run the config through the migration pipeline up to CURRENT_SCHEMA_VERSION."""
    version = config.get("schema_version", 1)
    while version < CURRENT_SCHEMA_VERSION:
        if version not in _migrations:
            raise ValueError(f"No migration path from schema version {version}")
        config = _migrations[version](config)
        version += 1
    config["schema_version"] = CURRENT_SCHEMA_VERSION
    return config
