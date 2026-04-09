"""Async engine pool manager for data source connections."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import TYPE_CHECKING

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.services.encryption import EncryptionService
from app.services.uri_builder import build_async_uri

if TYPE_CHECKING:
    from app.db.models.connection import RecvizConnection

logger = logging.getLogger(__name__)

# Default pool settings per D-09
DEFAULT_POOL_KWARGS = {
    "pool_size": 5,
    "max_overflow": 10,
    "pool_timeout": 30,
    "pool_recycle": 1800,
    "pool_pre_ping": True,
}

# Health check SQL per dialect
HEALTH_CHECK_SQL = {
    "oracle": "SELECT 1 FROM DUAL",
    "postgresql": "SELECT 1",
}


class EngineManager:
    """Manages async SQLAlchemy engines for data source connections.

    One AsyncEngine per registered database, keyed by connection UUID.
    Engines are created lazily on first access and disposed on
    connection update/delete.
    """

    def __init__(self, encryption: EncryptionService) -> None:
        self._engines: dict[str, AsyncEngine] = {}
        self._lock = asyncio.Lock()
        self._encryption = encryption

    async def get_engine(self, connection_id: str, uri: str, **pool_kwargs: object) -> AsyncEngine:
        """Get or create a cached async engine for the given connection ID."""
        if connection_id in self._engines:
            return self._engines[connection_id]
        async with self._lock:
            # Double-check after acquiring lock
            if connection_id in self._engines:
                return self._engines[connection_id]
            merged_kwargs = {**DEFAULT_POOL_KWARGS, **pool_kwargs}
            engine = create_async_engine(uri, **merged_kwargs)
            self._engines[connection_id] = engine
            logger.info("Created engine for connection %s", connection_id)
            return engine

    async def get_engine_for_connection(self, conn: RecvizConnection) -> AsyncEngine:
        """Build URI from connection record and get/create a cached engine."""
        password = self._encryption.decrypt(conn.encrypted_password)
        uri = build_async_uri(
            backend=conn.backend,
            host=conn.host,
            port=conn.port,
            database=conn.database_name,
            username=conn.username,
            password=password,
        )
        return await self.get_engine(conn.id, uri)

    async def dispose_engine(self, connection_id: str) -> None:
        """Dispose and remove the engine for a connection (e.g., on update/delete)."""
        async with self._lock:
            engine = self._engines.pop(connection_id, None)
            if engine:
                await engine.dispose()
                logger.info("Disposed engine for connection %s", connection_id)

    async def dispose_all(self) -> None:
        """Dispose all engines (e.g., on application shutdown)."""
        async with self._lock:
            for conn_id, engine in self._engines.items():
                await engine.dispose()
                logger.info("Disposed engine for connection %s", conn_id)
            self._engines.clear()

    @property
    def engine_count(self) -> int:
        """Number of active engines in the pool."""
        return len(self._engines)

    @staticmethod
    async def test_connection(uri: str, backend: str, timeout: int = 10) -> tuple[bool, str]:
        """Test database connectivity with a disposable engine.

        Creates a temporary single-connection engine, executes a health check
        query, and immediately disposes the engine. Returns (success, message).
        """
        test_sql = HEALTH_CHECK_SQL.get(backend, "SELECT 1")
        engine = create_async_engine(
            uri,
            pool_size=1,
            max_overflow=0,
            pool_timeout=timeout,
        )
        try:
            async with engine.connect() as conn:
                await conn.execute(text(test_sql))
            return True, "Connection successful"
        except Exception as exc:
            # Strip potential connection URIs from error messages to avoid leaking credentials
            raw_msg = str(exc)
            sanitized = re.sub(r"(://)[^@]*@", r"\1***:***@", raw_msg)
            return False, sanitized
        finally:
            await engine.dispose()
