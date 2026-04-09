"""Unit tests for ConnectionResolver and ConnectionStatusTracker string keys."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.connection_resolver import ConnectionResolver
from app.services.connection_status import ConnectionStatusTracker


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def _make_mock_connection(
    id: str,
    name: str,
    backend: str,
    schema_name: str = "",
) -> MagicMock:
    """Create a mock RecvizConnection row."""
    conn = MagicMock()
    conn.id = id
    conn.name = name
    conn.backend = backend
    conn.schema_name = schema_name
    return conn


def _build_mock_session(connections: list) -> AsyncMock:
    """Build a mock AsyncSession whose execute() returns scalars for given connections."""
    session = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalars.return_value.all.return_value = connections
    session.execute.return_value = result_mock
    return session


# ---------------------------------------------------------------------------
# ConnectionResolver tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_loads_connections_into_cache():
    """Test 1: sync() loads all connections from DB into cache."""
    connections = [
        _make_mock_connection("uuid-1", "superset_db_TCOSPRD", "oracle", "TCOS"),
        _make_mock_connection("uuid-2", "superset_db_DEV", "postgresql", "public"),
    ]
    session = _build_mock_session(connections)
    resolver = ConnectionResolver()

    await resolver.sync(session)

    # Both connections should be resolvable
    assert await resolver.resolve("superset_db_TCOSPRD") == "uuid-1"
    assert await resolver.resolve("superset_db_DEV") == "uuid-2"


@pytest.mark.asyncio
async def test_resolve_returns_uuid_for_known_name():
    """Test 2: resolve() returns UUID string for a known name."""
    connections = [
        _make_mock_connection("abc-123-def", "superset_db_TCOSPRD", "oracle"),
    ]
    session = _build_mock_session(connections)
    resolver = ConnectionResolver()
    await resolver.sync(session)

    result = await resolver.resolve("superset_db_TCOSPRD")
    assert result == "abc-123-def"
    assert isinstance(result, str)


@pytest.mark.asyncio
async def test_resolve_raises_for_unknown_name():
    """Test 3: resolve() raises ValueError for nonexistent name."""
    connections = [
        _make_mock_connection("uuid-1", "known_db", "postgresql"),
    ]
    session = _build_mock_session(connections)
    resolver = ConnectionResolver()
    await resolver.sync(session)

    with pytest.raises(ValueError, match="Database 'nonexistent' not registered"):
        await resolver.resolve("nonexistent")


@pytest.mark.asyncio
async def test_get_dialect_returns_backend():
    """Test 4: get_dialect() returns dialect based on backend field."""
    connections = [
        _make_mock_connection("uuid-1", "oracle_db", "oracle"),
        _make_mock_connection("uuid-2", "pg_db", "postgresql"),
    ]
    session = _build_mock_session(connections)
    resolver = ConnectionResolver()
    await resolver.sync(session)

    assert resolver.get_dialect("oracle_db") == "oracle"
    assert resolver.get_dialect("pg_db") == "postgresql"


@pytest.mark.asyncio
async def test_get_dialect_defaults_to_oracle():
    """Test 4b: get_dialect() returns 'oracle' for unknown name."""
    resolver = ConnectionResolver()
    assert resolver.get_dialect("nonexistent") == "oracle"


@pytest.mark.asyncio
async def test_get_schema_returns_schema_name():
    """Test 5: get_schema() returns schema_name from cached connection."""
    connections = [
        _make_mock_connection("uuid-1", "oracle_db", "oracle", "TCOS"),
    ]
    session = _build_mock_session(connections)
    resolver = ConnectionResolver()
    await resolver.sync(session)

    assert resolver.get_schema("oracle_db") == "TCOS"


@pytest.mark.asyncio
async def test_get_schema_returns_empty_for_unknown():
    """Test 5b: get_schema() returns '' for unknown name."""
    resolver = ConnectionResolver()
    assert resolver.get_schema("nonexistent") == ""


@pytest.mark.asyncio
async def test_get_all_schemas_returns_non_empty_set():
    """Test 6: get_all_schemas() returns set of all non-empty schema names."""
    connections = [
        _make_mock_connection("uuid-1", "oracle_db", "oracle", "TCOS"),
        _make_mock_connection("uuid-2", "pg_db", "postgresql", "public"),
        _make_mock_connection("uuid-3", "no_schema_db", "postgresql", ""),
    ]
    session = _build_mock_session(connections)
    resolver = ConnectionResolver()
    await resolver.sync(session)

    schemas = resolver.get_all_schemas()
    assert schemas == {"TCOS", "public"}
    assert "" not in schemas


@pytest.mark.asyncio
async def test_invalidate_clears_and_resyncs():
    """Test 7: invalidate() clears cache, next resolve re-reads from DB."""
    conn1 = _make_mock_connection("uuid-1", "db_a", "oracle")
    conn2 = _make_mock_connection("uuid-2", "db_b", "postgresql")

    session = AsyncMock()
    call_count = 0

    async def mock_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        if call_count == 1:
            # First sync: only db_a
            result.scalars.return_value.all.return_value = [conn1]
        else:
            # After invalidate: both db_a and db_b
            result.scalars.return_value.all.return_value = [conn1, conn2]
        return result

    session.execute = mock_execute

    resolver = ConnectionResolver()
    await resolver.sync(session)

    # Initially only db_a is known
    assert await resolver.resolve("db_a") == "uuid-1"
    with pytest.raises(ValueError):
        await resolver.resolve("db_b")

    # After invalidate, db_b should be available
    await resolver.invalidate(session)
    assert await resolver.resolve("db_b") == "uuid-2"


# ---------------------------------------------------------------------------
# ConnectionStatusTracker string key tests
# ---------------------------------------------------------------------------

def test_status_tracker_uses_string_keys():
    """Test 8: ConnectionStatusTracker uses str keys."""
    tracker = ConnectionStatusTracker()

    # mark_connected with string UUID
    tracker.mark_connected("uuid-abc-123")
    status = tracker.get_status("uuid-abc-123")
    assert status["status"] == "connected"
    assert status["last_tested"] is not None

    # mark_unreachable with string UUID
    tracker.mark_unreachable("uuid-def-456")
    status = tracker.get_status("uuid-def-456")
    assert status["status"] == "unreachable"

    # Unknown UUID returns untested
    status = tracker.get_status("uuid-unknown")
    assert status["status"] == "untested"
    assert status["last_tested"] is None

    # remove with string UUID
    tracker.remove("uuid-abc-123")
    status = tracker.get_status("uuid-abc-123")
    assert status["status"] == "untested"
