"""Tests for managed dataset CRUD API endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.managed_datasets import router
from app.models.managed_dataset import DatasetResponse
from app.services.dataset_sync import DatasetSyncService


# ── Test fixtures ────────────────────────────────────────────────


def _make_dataset_row(
    *,
    dataset_id: str = "test-uuid-1",
    name: str = "Test Dataset",
    description: str = "A test dataset",
    database_id: int = 1,
    superset_id: int | None = 42,
    sql: str = "SELECT * FROM recon",
    columns: list | None = None,
    sync_status: str = "synced",
    schema_version: int = 1,
) -> MagicMock:
    """Create a mock RecvizDataset row."""
    row = MagicMock()
    row.id = dataset_id
    row.name = name
    row.description = description
    row.database_id = database_id
    row.superset_id = superset_id
    row.sql = sql
    row.columns = columns or []
    row.sync_status = sync_status
    row.schema_version = schema_version
    row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return row


def _create_test_app(session_mock: AsyncMock, sync_mock: MagicMock) -> FastAPI:
    """Create a minimal FastAPI app with mocked dependencies."""
    from app.core.dependencies import get_db_session

    test_app = FastAPI()
    test_app.include_router(router)

    # Store the dataset sync service on app state
    test_app.state.dataset_sync = sync_mock

    async def override_db():
        yield session_mock

    test_app.dependency_overrides[get_db_session] = override_db

    return test_app


VALID_CREATE_BODY = {
    "name": "My Dataset",
    "description": "Testing",
    "databaseId": 1,
    "sql": "SELECT * FROM recon",
    "columns": [
        {
            "name": "amount",
            "displayName": "Amount",
            "dataType": "number",
            "role": "measure",
            "aggregation": "SUM",
            "formatPreset": "none",
            "formatString": "",
        }
    ],
}


# ── POST tests ───────────────────────────────────────────────────


def test_create_managed_dataset_returns_201():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()

    sync_service = MagicMock(spec=DatasetSyncService)
    sync_service.sync_dataset = AsyncMock(return_value=42)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.post("/api/datasets/managed", json=VALID_CREATE_BODY)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Dataset"
    assert data["databaseId"] == 1
    assert data["syncStatus"] == "synced"
    assert data["supersetId"] == 42


def test_create_managed_dataset_empty_name_returns_422():
    session = AsyncMock()
    sync_service = MagicMock(spec=DatasetSyncService)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    body = {**VALID_CREATE_BODY, "name": ""}
    resp = client.post("/api/datasets/managed", json=body)
    assert resp.status_code == 422


def test_create_managed_dataset_sync_failure_returns_201_with_error_status():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()

    sync_service = MagicMock(spec=DatasetSyncService)
    sync_service.sync_dataset = AsyncMock(return_value=None)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.post("/api/datasets/managed", json=VALID_CREATE_BODY)
    assert resp.status_code == 201
    data = resp.json()
    assert data["syncStatus"] == "error"
    assert data["supersetId"] is None


# ── GET list tests ───────────────────────────────────────────────


def test_list_managed_datasets_returns_list():
    row = _make_dataset_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[row])))
    session.execute = AsyncMock(return_value=mock_result)

    sync_service = MagicMock(spec=DatasetSyncService)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "Test Dataset"


# ── GET single tests ─────────────────────────────────────────────


def test_get_managed_dataset_returns_dataset():
    row = _make_dataset_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    sync_service = MagicMock(spec=DatasetSyncService)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed/test-uuid-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Dataset"
    assert data["id"] == "test-uuid-1"


def test_get_managed_dataset_unknown_id_returns_404():
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    session.execute = AsyncMock(return_value=mock_result)

    sync_service = MagicMock(spec=DatasetSyncService)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed/nonexistent")
    assert resp.status_code == 404


# ── PUT tests ────────────────────────────────────────────────────


def test_update_managed_dataset_returns_200():
    row = _make_dataset_row(sql="SELECT 1")

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)
    session.flush = AsyncMock()

    sync_service = MagicMock(spec=DatasetSyncService)
    sync_service.sync_dataset = AsyncMock(return_value=42)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.put(
        "/api/datasets/managed/test-uuid-1",
        json={"sql": "SELECT * FROM updated"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["syncStatus"] == "synced"


# ── DELETE tests ─────────────────────────────────────────────────


def test_delete_managed_dataset_returns_204():
    row = _make_dataset_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)
    session.delete = AsyncMock()

    sync_service = MagicMock(spec=DatasetSyncService)
    sync_service.delete_synced = AsyncMock()

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.delete("/api/datasets/managed/test-uuid-1")
    assert resp.status_code == 204
    sync_service.delete_synced.assert_called_once_with(42)


# ── References tests ─────────────────────────────────────────────


def test_get_dataset_references_returns_can_delete():
    row = _make_dataset_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    sync_service = MagicMock(spec=DatasetSyncService)

    app = _create_test_app(session, sync_service)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed/test-uuid-1/references")
    assert resp.status_code == 200
    data = resp.json()
    assert data["canDelete"] is True
    assert data["referencingCharts"] == []
