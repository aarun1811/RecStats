"""Sync engine pool manager for data source connections.

Converted from async to sync on 2026-04-10. See ``app/db/engine.py`` docstring
for the rationale (oracledb async is thin-mode only; many Oracle environments
require thick mode).

Thread safety: multiple FastAPI threadpool workers may call into this manager
concurrently. We use a ``threading.Lock`` to serialize engine creation and
disposal. Reads of the ``_engines`` dict are atomic for the hot path.
"""

from __future__ import annotations

import logging
import re
import threading
from typing import TYPE_CHECKING

from sqlalchemy import Engine, create_engine, event, text

from app.services.encryption import EncryptionService
from app.services.uri_builder import build_sync_uri

if TYPE_CHECKING:
    from app.db.models.connection import RecvizConnection

logger = logging.getLogger(__name__)

# Default pool settings per D-09. Note: pool_timeout only bounds connection
# acquisition; per-query execution timeout is set via _connect_args_for_backend.
DEFAULT_POOL_KWARGS = {
    "pool_size": 5,
    "max_overflow": 10,
    "pool_timeout": 30,
    "pool_recycle": 1800,
    "pool_pre_ping": True,
}

# Per-query execution timeout (seconds). Applied via driver-specific
# connect_args in _connect_args_for_backend.
QUERY_EXECUTION_TIMEOUT_SECONDS = 60

# Health check SQL per dialect
HEALTH_CHECK_SQL = {
    "oracle": "SELECT 1 FROM DUAL",
    "postgresql": "SELECT 1",
}


def _connect_args_for_backend(backend: str | None) -> dict:
    """Return per-backend connect_args to enforce a server-side query timeout.

    PostgreSQL (psycopg2): the ``-c statement_timeout=<ms>`` option sets a
    per-session statement timeout at connection time.

    Oracle: NOT handled here -- ``call_timeout`` is a ``Connection``
    attribute on python-oracledb, not a ``connect()`` kwarg. It is set via
    a SQLAlchemy ``connect`` event listener in ``EngineManager.get_engine``
    instead. Forwarding it through ``connect_args`` raises
    ``connect() got an unexpected keyword argument 'call_timeout'``.

    Unknown backends get no timeout and fall back to DB/pool defaults.
    """
    if not backend:
        return {}
    if backend == "postgresql":
        return {
            "options": f"-c statement_timeout={QUERY_EXECUTION_TIMEOUT_SECONDS * 1000}"
        }
    return {}


def _install_oracle_call_timeout(engine: Engine) -> None:
    """Attach a ``connect`` listener that sets ``call_timeout`` on every new
    python-oracledb connection.

    ``call_timeout`` is in milliseconds. It bounds a single round-trip call
    (not the total query duration, but for single-statement workloads the
    effect is the same -- long-running queries are interrupted).
    """
    timeout_ms = QUERY_EXECUTION_TIMEOUT_SECONDS * 1000

    @event.listens_for(engine, "connect")
    def _set_call_timeout(dbapi_conn, connection_record):  # noqa: ARG001
        try:
            dbapi_conn.call_timeout = timeout_ms
        except Exception as exc:  # noqa: BLE001 - best-effort
            logger.warning("Failed to set Oracle call_timeout: %s", exc)


class EngineManager:
    """Manages sync SQLAlchemy engines for data source connections.

    One Engine per registered database, keyed by connection UUID. Engines
    are created lazily on first access and disposed on connection
    update/delete.
    """

    def __init__(self, encryption: EncryptionService) -> None:
        self._engines: dict[str, Engine] = {}
        self._lock = threading.Lock()
        self._encryption = encryption

    def get_engine(
        self,
        connection_id: str,
        uri: str,
        backend: str | None = None,
        **pool_kwargs: object,
    ) -> Engine:
        """Get or create a cached sync engine for the given connection ID."""
        # Atomic fast path — dict.get is a single GIL-protected operation,
        # so it avoids the in-then-[] race with dispose_engine.
        engine = self._engines.get(connection_id)
        if engine is not None:
            return engine
        with self._lock:
            # Double-check after acquiring lock
            engine = self._engines.get(connection_id)
            if engine is not None:
                return engine
            merged_kwargs = {**DEFAULT_POOL_KWARGS, **pool_kwargs}
            # Per-backend connect_args (PostgreSQL only -- Oracle gets its
            # call_timeout via the event listener below, because it is a
            # Connection attribute not a connect() kwarg).
            connect_args = _connect_args_for_backend(backend)
            if connect_args:
                merged_kwargs.setdefault("connect_args", connect_args)
            engine = create_engine(uri, **merged_kwargs)
            if backend == "oracle":
                _install_oracle_call_timeout(engine)
            self._engines[connection_id] = engine
            logger.info("Created engine for connection %s", connection_id)
            return engine

    def get_engine_for_connection(self, conn: RecvizConnection) -> Engine:
        """Build URI from connection record and get/create a cached engine."""
        # Fast path: avoid decrypting the password when the engine is
        # already cached.
        cached = self._engines.get(conn.id)
        if cached is not None:
            return cached
        password = self._encryption.decrypt(conn.encrypted_password)
        uri = build_sync_uri(
            backend=conn.backend,
            host=conn.host,
            port=conn.port,
            database=conn.database_name,
            username=conn.username,
            password=password,
        )
        return self.get_engine(conn.id, uri, backend=conn.backend)

    def dispose_engine(self, connection_id: str) -> None:
        """Dispose and remove the engine for a connection (e.g., on update/delete)."""
        with self._lock:
            engine = self._engines.pop(connection_id, None)
            if engine:
                engine.dispose()
                logger.info("Disposed engine for connection %s", connection_id)

    def dispose_all(self) -> None:
        """Dispose all engines (e.g., on application shutdown)."""
        with self._lock:
            for conn_id, engine in self._engines.items():
                engine.dispose()
                logger.info("Disposed engine for connection %s", conn_id)
            self._engines.clear()

    @property
    def engine_count(self) -> int:
        """Number of active engines in the pool."""
        return len(self._engines)

    @staticmethod
    def test_connection(uri: str, backend: str, timeout: int = 10) -> tuple[bool, str]:
        """Test database connectivity with a disposable sync engine.

        Creates a temporary single-connection engine, executes a health check
        query, and immediately disposes the engine. Returns (success, message).
        The ``timeout`` parameter governs pool acquisition; the single
        ``SELECT 1`` health check does not need a query-execution timeout.
        """
        test_sql = HEALTH_CHECK_SQL.get(backend, "SELECT 1")
        # Only PostgreSQL gets connect_args here; Oracle's call_timeout
        # cannot be passed as a connect() kwarg (it is a Connection
        # attribute set via the "connect" event listener below).
        connect_args = (
            _connect_args_for_backend(backend) if backend == "postgresql" else {}
        )
        engine = create_engine(
            uri,
            pool_size=1,
            max_overflow=0,
            pool_timeout=timeout,
            connect_args=connect_args,
        )
        if backend == "oracle":
            _install_oracle_call_timeout(engine)
        try:
            with engine.connect() as conn:
                conn.execute(text(test_sql))
            return True, "Connection successful"
        except Exception as exc:
            # Strip potential connection URIs from error messages to avoid leaking credentials
            raw_msg = str(exc)
            sanitized = re.sub(r"(://)[^@]*@", r"\1***:***@", raw_msg)
            return False, sanitized
        finally:
            engine.dispose()
