"""Tests for EngineManager -- async engine pool with connection testing."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.engine_manager import EngineManager


@pytest.fixture()
def encryption() -> MagicMock:
    """Mock EncryptionService that returns 'decrypted_pass' on decrypt."""
    svc = MagicMock()
    svc.decrypt.return_value = "decrypted_pass"
    return svc


@pytest.fixture()
def manager(encryption: MagicMock) -> EngineManager:
    return EngineManager(encryption=encryption)


def _make_mock_engine() -> MagicMock:
    """Create a mock AsyncEngine with async dispose."""
    engine = MagicMock()
    engine.dispose = AsyncMock()
    return engine


# ---------------------------------------------------------------------------
# Test 1: get_engine creates and caches engine
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
@patch("app.services.engine_manager.create_async_engine")
async def test_get_engine_creates_and_caches(mock_create: MagicMock, manager: EngineManager) -> None:
    mock_engine = _make_mock_engine()
    mock_create.return_value = mock_engine

    engine1 = await manager.get_engine("conn-1", "postgresql+asyncpg://localhost/db")
    engine2 = await manager.get_engine("conn-1", "postgresql+asyncpg://localhost/db")

    assert engine1 is engine2
    mock_create.assert_called_once()  # Only created once (cached)


# ---------------------------------------------------------------------------
# Test 2: dispose_engine removes from cache and calls dispose
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
@patch("app.services.engine_manager.create_async_engine")
async def test_dispose_engine_removes_and_disposes(mock_create: MagicMock, manager: EngineManager) -> None:
    mock_engine = _make_mock_engine()
    mock_create.return_value = mock_engine

    await manager.get_engine("conn-1", "postgresql+asyncpg://localhost/db")
    assert manager.engine_count == 1

    await manager.dispose_engine("conn-1")
    assert manager.engine_count == 0
    mock_engine.dispose.assert_awaited_once()


# ---------------------------------------------------------------------------
# Test 3: dispose_engine for non-existent id does not raise
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
async def test_dispose_engine_nonexistent_no_error(manager: EngineManager) -> None:
    await manager.dispose_engine("does-not-exist")  # Should not raise


# ---------------------------------------------------------------------------
# Test 4: dispose_all disposes all engines and clears cache
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
@patch("app.services.engine_manager.create_async_engine")
async def test_dispose_all_clears_everything(mock_create: MagicMock, manager: EngineManager) -> None:
    engines = [_make_mock_engine(), _make_mock_engine()]
    mock_create.side_effect = engines

    await manager.get_engine("conn-1", "postgresql+asyncpg://localhost/db1")
    await manager.get_engine("conn-2", "postgresql+asyncpg://localhost/db2")
    assert manager.engine_count == 2

    await manager.dispose_all()
    assert manager.engine_count == 0
    for eng in engines:
        eng.dispose.assert_awaited_once()


# ---------------------------------------------------------------------------
# Test 5: test_connection postgresql executes SELECT 1
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
@patch("app.services.engine_manager.create_async_engine")
async def test_test_connection_postgresql_success(mock_create: MagicMock) -> None:
    mock_conn = AsyncMock()
    mock_engine = MagicMock()
    mock_engine.dispose = AsyncMock()
    # engine.connect() returns an async context manager yielding mock_conn
    mock_engine.connect.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)
    mock_create.return_value = mock_engine

    success, msg = await EngineManager.test_connection(
        uri="postgresql+asyncpg://localhost/db",
        backend="postgresql",
    )

    assert success is True
    assert msg == "Connection successful"
    # Verify SELECT 1 was executed (not SELECT 1 FROM DUAL)
    mock_conn.execute.assert_awaited_once()
    executed_sql = str(mock_conn.execute.call_args[0][0])
    assert "SELECT 1" in executed_sql
    assert "DUAL" not in executed_sql
    mock_engine.dispose.assert_awaited_once()


# ---------------------------------------------------------------------------
# Test 6: test_connection oracle executes SELECT 1 FROM DUAL
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
@patch("app.services.engine_manager.create_async_engine")
async def test_test_connection_oracle_dual(mock_create: MagicMock) -> None:
    mock_conn = AsyncMock()
    mock_engine = MagicMock()
    mock_engine.dispose = AsyncMock()
    mock_engine.connect.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)
    mock_create.return_value = mock_engine

    success, msg = await EngineManager.test_connection(
        uri="oracle+oracledb://localhost/db",
        backend="oracle",
    )

    assert success is True
    assert msg == "Connection successful"
    executed_sql = str(mock_conn.execute.call_args[0][0])
    assert "DUAL" in executed_sql


# ---------------------------------------------------------------------------
# Test 7: test_connection returns (False, error) on failure
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
@patch("app.services.engine_manager.create_async_engine")
async def test_test_connection_failure(mock_create: MagicMock) -> None:
    mock_engine = MagicMock()
    mock_engine.dispose = AsyncMock()
    mock_engine.connect.return_value.__aenter__ = AsyncMock(
        side_effect=Exception("Connection refused")
    )
    mock_engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)
    mock_create.return_value = mock_engine

    success, msg = await EngineManager.test_connection(
        uri="postgresql+asyncpg://badhost/db",
        backend="postgresql",
    )

    assert success is False
    assert "Connection refused" in msg
    mock_engine.dispose.assert_awaited_once()


# ---------------------------------------------------------------------------
# Test 8: get_engine_for_connection builds URI from RecvizConnection fields
# ---------------------------------------------------------------------------
@pytest.mark.asyncio()
@patch("app.services.engine_manager.build_async_uri", return_value="postgresql+asyncpg://user:pass@host:5432/db")
@patch("app.services.engine_manager.create_async_engine")
async def test_get_engine_for_connection(
    mock_create: MagicMock,
    mock_build_uri: MagicMock,
    manager: EngineManager,
    encryption: MagicMock,
) -> None:
    mock_create.return_value = _make_mock_engine()

    # Create a mock RecvizConnection
    conn = MagicMock()
    conn.id = "uuid-123"
    conn.backend = "postgresql"
    conn.host = "db-host"
    conn.port = 5432
    conn.database_name = "recon_data"
    conn.username = "admin"
    conn.encrypted_password = "encrypted_blob"

    engine = await manager.get_engine_for_connection(conn)

    assert engine is not None
    encryption.decrypt.assert_called_once_with("encrypted_blob")
    mock_build_uri.assert_called_once_with(
        backend="postgresql",
        host="db-host",
        port=5432,
        database="recon_data",
        username="admin",
        password="decrypted_pass",
    )
