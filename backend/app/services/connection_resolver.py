"""Resolves logical database names to connection UUIDs from recviz_connections.

Replaces the Superset-era DatabaseRegistrar with a direct DB lookup.
ConnectionResolver caches connection metadata (never passwords) in memory
for fast name-to-UUID resolution, dialect detection, and schema lookups.
"""

from __future__ import annotations

import logging
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.connection import RecvizConnection

logger = logging.getLogger(__name__)


class ConnectionInfo(NamedTuple):
    """Cached metadata for a registered connection (no secrets)."""

    id: str
    backend: str
    schema_name: str
    dialect: str


class ConnectionResolver:
    """Resolves logical database names to connection UUIDs from recviz_connections."""

    def __init__(self) -> None:
        self._cache: dict[str, ConnectionInfo] = {}

    def sync(self, session: Session) -> None:
        """Load all connections from recviz_connections into the in-memory cache.

        Maps the ``backend`` field to a ``dialect`` string (oracle -> oracle,
        postgresql -> postgresql). Only metadata is cached -- passwords are
        never stored in this resolver.
        """
        stmt = select(RecvizConnection)
        result = session.execute(stmt)
        rows = result.scalars().all()

        self._cache.clear()
        for row in rows:
            dialect = row.backend  # "oracle" or "postgresql"
            info = ConnectionInfo(
                id=row.id,
                backend=row.backend,
                schema_name=row.schema_name or "",
                dialect=dialect,
            )
            self._cache[row.name] = info
            logger.debug("Cached connection '%s' -> %s (%s)", row.name, row.id, dialect)

        logger.info("ConnectionResolver synced %d connection(s)", len(self._cache))

    def resolve(self, name: str) -> str:
        """Return the connection UUID for a logical database name.

        Raises ``ValueError`` if the name is not in the cache.
        """
        info = self._cache.get(name)
        if info is None:
            raise ValueError(f"Database '{name}' not registered")
        return info.id

    def get_dialect(self, name: str) -> str:
        """Return the SQL dialect for a database name.

        Defaults to ``"oracle"`` if the name is not cached.
        """
        info = self._cache.get(name)
        return info.dialect if info else "oracle"

    def get_schema(self, name: str) -> str:
        """Return the schema name for a database name.

        Returns ``""`` if the name is not cached.
        """
        info = self._cache.get(name)
        return info.schema_name if info else ""

    def get_all_schemas(self) -> set[str]:
        """Return the set of all non-empty schema names across all cached connections."""
        return {info.schema_name for info in self._cache.values() if info.schema_name}

    def invalidate(self, session: Session) -> None:
        """Clear cache and re-read from the database."""
        self._cache.clear()
        self.sync(session)
