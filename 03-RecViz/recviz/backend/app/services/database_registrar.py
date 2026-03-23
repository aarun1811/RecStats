from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import TYPE_CHECKING

from app.models.database_config import DatabaseEntry, DatabasesConfig

if TYPE_CHECKING:
    from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)


class DatabaseRegistrar:
    """Syncs databases.json into Superset and caches name -> Superset ID."""

    def __init__(
        self,
        superset_client: SupersetClient,
        config_path: str | None = None,
    ) -> None:
        self._superset = superset_client
        self._config_path = config_path
        self._entries: list[DatabaseEntry] = []
        self._cache: dict[str, DatabaseEntry] = {}
        self._negative_cache: set[str] = set()
        self._refresh_lock = asyncio.Lock()
        self._last_refresh: float = 0.0

        if config_path:
            self._load_config(config_path)

    def _load_config(self, path: str) -> None:
        raw = json.loads(Path(path).read_text())
        config = DatabasesConfig.model_validate(raw)
        self._entries = config.databases

    async def sync(self) -> None:
        """Register missing databases in Superset, populate cache."""
        existing = await self._superset.list_databases()
        existing_by_name: dict[str, dict] = {
            db.get("database_name", ""): db for db in existing
        }

        for entry in self._entries:
            if entry.name in existing_by_name:
                entry.superset_id = existing_by_name[entry.name]["id"]
                self._cache[entry.name] = entry
                logger.info(
                    "Database '%s' already registered (id=%d)",
                    entry.name,
                    entry.superset_id,
                )
            else:
                try:
                    result = await self._superset.create_database(
                        {
                            "database_name": entry.name,
                            "sqlalchemy_uri": entry.sqlalchemy_uri,
                            "expose_in_sqllab": True,
                            "allow_run_async": False,
                            "allow_ctas": False,
                            "allow_cvas": False,
                        }
                    )
                    entry.superset_id = result.get("id") or result.get(
                        "result", {}
                    ).get("id")
                    self._cache[entry.name] = entry
                    logger.info(
                        "Registered database '%s' in Superset (id=%s)",
                        entry.name,
                        entry.superset_id,
                    )
                except Exception as e:
                    logger.warning(
                        "Failed to register database '%s' in Superset: %s "
                        "(if using local dev, ensure seed.db exists: "
                        "python scripts/generate-seed-db.py)",
                        entry.name,
                        e,
                    )

        self._negative_cache.clear()
        self._last_refresh = time.time()

    async def _refresh_cache(self) -> None:
        """Refresh cache from Superset's database list (full rebuild)."""
        existing = await self._superset.list_databases()
        existing_by_name = {
            db.get("database_name", ""): db for db in existing
        }
        self._cache.clear()
        for entry in self._entries:
            if entry.name in existing_by_name:
                entry.superset_id = existing_by_name[entry.name]["id"]
                self._cache[entry.name] = entry
            else:
                entry.superset_id = None
        self._negative_cache.clear()
        self._last_refresh = time.time()

    async def resolve(self, name: str) -> int:
        """Resolve logical database name to Superset numeric ID."""
        if name in self._cache:
            entry = self._cache[name]
            if entry.superset_id is not None:
                return entry.superset_id
        if name in self._negative_cache:
            raise ValueError(f"Database '{name}' not registered in Superset")
        async with self._refresh_lock:
            # Double-check after acquiring lock
            if name in self._cache and self._cache[name].superset_id is not None:
                return self._cache[name].superset_id
            if (time.time() - self._last_refresh) > 30:
                await self._refresh_cache()
        if name in self._cache and self._cache[name].superset_id is not None:
            return self._cache[name].superset_id
        self._negative_cache.add(name)
        raise ValueError(f"Database '{name}' not registered in Superset")

    def get_dialect(self, name: str) -> str:
        """Get SQL dialect for a database."""
        entry = self._cache.get(name)
        return entry.dialect if entry else "oracle"

    def get_schema(self, name: str) -> str:
        """Get schema name for a database."""
        entry = self._cache.get(name)
        return entry.schema_name if entry else ""

    def get_all_schemas(self) -> set[str]:
        """Get all known schema names (for schema prefix stripping)."""
        return {e.schema_name for e in self._cache.values() if e.schema_name}
