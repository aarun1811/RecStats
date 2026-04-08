"""Tests for DatasetSyncService and SupersetClient dataset methods."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── SupersetClient dataset method tests ──────────────────────────


@pytest.mark.asyncio
async def test_superset_create_dataset_posts_to_correct_endpoint():
    from app.services.superset_client import SupersetClient

    http = AsyncMock()
    http.request = AsyncMock(
        return_value=MagicMock(
            status_code=201,
            is_success=True,
            json=lambda: {"result": {"id": 42}},
            raise_for_status=MagicMock(),
        )
    )
    http.get = AsyncMock(
        return_value=MagicMock(
            is_success=True,
            json=lambda: {"result": "csrf_token_value"},
        )
    )
    http.post = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            json=lambda: {"access_token": "test_token"},
            raise_for_status=MagicMock(),
        )
    )

    client = SupersetClient(http)
    client._token = "test"
    client._token_ts = 9999999999.0

    payload = {"database": 1, "table_name": "recviz__abc", "sql": "SELECT 1", "schema": ""}
    result = await client.create_dataset(payload)

    http.request.assert_called_once()
    call_args = http.request.call_args
    assert call_args[0][0] == "POST"
    assert "/api/v1/dataset/" in call_args[0][1]
    assert call_args[1]["json"] == payload
    assert result == {"id": 42}


@pytest.mark.asyncio
async def test_superset_update_dataset_puts_to_correct_endpoint():
    from app.services.superset_client import SupersetClient

    http = AsyncMock()
    http.request = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            is_success=True,
            json=lambda: {"result": {"id": 42}},
            raise_for_status=MagicMock(),
        )
    )

    client = SupersetClient(http)
    client._token = "test"
    client._token_ts = 9999999999.0

    payload = {"database_id": 1, "table_name": "recviz__abc", "sql": "SELECT 2"}
    result = await client.update_dataset(42, payload)

    http.request.assert_called_once()
    call_args = http.request.call_args
    assert call_args[0][0] == "PUT"
    assert "/api/v1/dataset/42" in call_args[0][1]
    assert result == {"id": 42}


@pytest.mark.asyncio
async def test_superset_delete_dataset_sends_delete():
    from app.services.superset_client import SupersetClient

    http = AsyncMock()
    http.request = AsyncMock(
        return_value=MagicMock(
            status_code=200,
            is_success=True,
            json=lambda: {},
            raise_for_status=MagicMock(),
        )
    )

    client = SupersetClient(http)
    client._token = "test"
    client._token_ts = 9999999999.0

    await client.delete_dataset(42)

    http.request.assert_called_once()
    call_args = http.request.call_args
    assert call_args[0][0] == "DELETE"
    assert "/api/v1/dataset/42" in call_args[0][1]


# ── DatasetSyncService tests ────────────────────────────────────


@pytest.mark.asyncio
async def test_sync_dataset_creates_when_no_superset_id():
    from app.services.dataset_sync import DatasetSyncService

    superset = AsyncMock()
    superset.create_dataset = AsyncMock(return_value={"id": 55})

    service = DatasetSyncService(superset=superset)

    # Mock a RecvizDataset-like object
    dataset = MagicMock()
    dataset.id = "abc-123"
    dataset.database_id = 1
    dataset.superset_id = None
    dataset.sql = "SELECT * FROM recon"

    result = await service.sync_dataset(dataset)

    assert result == 55
    superset.create_dataset.assert_called_once()
    payload = superset.create_dataset.call_args[0][0]
    assert payload["database"] == 1
    assert payload["table_name"] == "recviz__abc-123"
    assert payload["sql"] == "SELECT * FROM recon"
    assert payload["schema"] == ""


@pytest.mark.asyncio
async def test_sync_dataset_updates_when_superset_id_exists():
    from app.services.dataset_sync import DatasetSyncService

    superset = AsyncMock()
    superset.update_dataset = AsyncMock(return_value={"id": 55})

    service = DatasetSyncService(superset=superset)

    dataset = MagicMock()
    dataset.id = "abc-123"
    dataset.database_id = 1
    dataset.superset_id = 55
    dataset.sql = "SELECT * FROM recon"

    result = await service.sync_dataset(dataset)

    assert result == 55
    superset.update_dataset.assert_called_once()
    call_args = superset.update_dataset.call_args
    assert call_args[0][0] == 55  # dataset_id
    payload = call_args[0][1]
    assert payload["database_id"] == 1
    assert payload["table_name"] == "recviz__abc-123"
    assert payload["sql"] == "SELECT * FROM recon"


@pytest.mark.asyncio
async def test_sync_dataset_returns_none_on_failure():
    from app.services.dataset_sync import DatasetSyncService

    superset = AsyncMock()
    superset.create_dataset = AsyncMock(side_effect=Exception("Superset down"))

    service = DatasetSyncService(superset=superset)

    dataset = MagicMock()
    dataset.id = "abc-123"
    dataset.database_id = 1
    dataset.superset_id = None
    dataset.sql = "SELECT 1"

    result = await service.sync_dataset(dataset)
    assert result is None


@pytest.mark.asyncio
async def test_reconcile_resyncs_unsynced_datasets():
    from app.services.dataset_sync import DatasetSyncService

    superset = AsyncMock()
    superset.create_dataset = AsyncMock(return_value={"id": 100})

    service = DatasetSyncService(superset=superset)

    # Create mock datasets
    ds1 = MagicMock()
    ds1.id = "ds-1"
    ds1.database_id = 1
    ds1.superset_id = None
    ds1.sql = "SELECT 1"
    ds1.sync_status = "error"

    ds2 = MagicMock()
    ds2.id = "ds-2"
    ds2.database_id = 2
    ds2.superset_id = None
    ds2.sql = "SELECT 2"
    ds2.sync_status = "unsynced"

    # Mock async session
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[ds1, ds2])))
    session.execute = AsyncMock(return_value=mock_result)

    await service.reconcile(session)

    # Both should have been synced
    assert superset.create_dataset.call_count == 2
    assert ds1.sync_status == "synced"
    assert ds2.sync_status == "synced"
    assert ds1.superset_id == 100
    assert ds2.superset_id == 100


@pytest.mark.asyncio
async def test_delete_synced_calls_superset_delete():
    from app.services.dataset_sync import DatasetSyncService

    superset = AsyncMock()
    superset.delete_dataset = AsyncMock()

    service = DatasetSyncService(superset=superset)

    await service.delete_synced(42)
    superset.delete_dataset.assert_called_once_with(42)


@pytest.mark.asyncio
async def test_delete_synced_noop_when_no_superset_id():
    from app.services.dataset_sync import DatasetSyncService

    superset = AsyncMock()
    superset.delete_dataset = AsyncMock()

    service = DatasetSyncService(superset=superset)

    await service.delete_synced(None)
    superset.delete_dataset.assert_not_called()


@pytest.mark.asyncio
async def test_delete_synced_does_not_raise_on_failure():
    from app.services.dataset_sync import DatasetSyncService

    superset = AsyncMock()
    superset.delete_dataset = AsyncMock(side_effect=Exception("Network error"))

    service = DatasetSyncService(superset=superset)

    # Should not raise
    await service.delete_synced(42)
