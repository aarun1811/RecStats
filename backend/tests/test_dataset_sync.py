"""Tests for SupersetClient dataset methods.

DatasetSyncService tests removed -- service deleted in Phase 14 Plan 02.
SupersetClient dataset methods remain until Phase 15 (Superset removal).
"""

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
