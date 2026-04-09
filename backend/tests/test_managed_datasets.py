"""Tests for managed dataset CRUD API endpoints.

Validates that dataset CRUD operates purely on recviz_datasets
with no Superset sync dependencies.
"""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.managed_datasets import router
from app.models.managed_dataset import DatasetResponse


# ── Test fixtures ────────────────────────────────────────────────


def _make_dataset_row(
    *,
    dataset_id: str = "test-uuid-1",
    name: str = "Test Dataset",
    description: str = "A test dataset",
    database_id: str = "db-uuid-1",
    sql: str = "SELECT * FROM recon",
    columns: list | None = None,
    schema_version: int = 1,
) -> MagicMock:
    """Create a mock RecvizDataset row (no superset_id or sync_status)."""
    row = MagicMock()
    row.id = dataset_id
    row.name = name
    row.description = description
    row.database_id = database_id
    row.sql = sql
    row.columns = columns or []
    row.schema_version = schema_version
    row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return row


def _create_test_app(session_mock: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with mocked DB session (no sync service)."""
    from app.core.dependencies import get_db_session

    test_app = FastAPI()
    test_app.include_router(router)

    async def override_db():
        yield session_mock

    test_app.dependency_overrides[get_db_session] = override_db

    return test_app


VALID_CREATE_BODY = {
    "name": "My Dataset",
    "description": "Testing",
    "databaseId": "db-uuid-1",
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


# ── Test: response has no superset_id or sync_status ────────────


def test_list_managed_datasets_no_sync_fields():
    """Verify list response has no superset_id or sync_status fields."""
    row = _make_dataset_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[row])))
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    item = data[0]
    assert item["name"] == "Test Dataset"
    assert "supersetId" not in item
    assert "syncStatus" not in item


# ── Test: create dataset ────────────────────────────────────────


def test_create_managed_dataset_returns_201():
    """Verify create returns 201 with no sync, no superset_id in response."""
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/datasets/managed", json=VALID_CREATE_BODY)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Dataset"
    assert data["databaseId"] == "db-uuid-1"
    assert "supersetId" not in data
    assert "syncStatus" not in data
    assert data["schemaVersion"] == 1


# ── Test: get single dataset ───────────────────────────────────


def test_get_managed_dataset_returns_dataset():
    """Verify single dataset response shape."""
    row = _make_dataset_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed/test-uuid-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Dataset"
    assert data["id"] == "test-uuid-1"
    assert "supersetId" not in data
    assert "syncStatus" not in data


# ── Test: update dataset ────────────────────────────────────────


def test_update_managed_dataset_returns_200():
    """Verify update works without sync service call."""
    row = _make_dataset_row(sql="SELECT 1")

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.put(
        "/api/datasets/managed/test-uuid-1",
        json={"sql": "SELECT * FROM updated"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "syncStatus" not in data
    assert "supersetId" not in data


# ── Test: delete dataset ────────────────────────────────────────


def test_delete_managed_dataset_returns_204():
    """Verify delete without Superset cleanup call."""
    row = _make_dataset_row()

    # Need two execute calls: first for dataset lookup, second for chart check, third for kpi check
    session = AsyncMock()
    # First call returns dataset, second returns empty charts, third returns empty kpis
    dataset_result = MagicMock()
    dataset_result.scalar_one_or_none = MagicMock(return_value=row)

    empty_scalars = MagicMock()
    empty_scalars.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

    session.execute = AsyncMock(side_effect=[dataset_result, empty_scalars, empty_scalars])
    session.delete = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.delete("/api/datasets/managed/test-uuid-1")
    assert resp.status_code == 204
    session.delete.assert_called_once()


# ── Test: delete dataset in use (409) ───────────────────────────


def test_delete_dataset_in_use_returns_409():
    """Verify 409 when charts reference the dataset."""
    row = _make_dataset_row()

    session = AsyncMock()
    dataset_result = MagicMock()
    dataset_result.scalar_one_or_none = MagicMock(return_value=row)

    # Charts referencing this dataset
    chart_mock = MagicMock()
    chart_mock.id = "chart-1"
    chart_mock.name = "My Chart"
    charts_result = MagicMock()
    charts_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[chart_mock]))
    )

    # No KPI references
    empty_kpis = MagicMock()
    empty_kpis.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

    session.execute = AsyncMock(side_effect=[dataset_result, charts_result, empty_kpis])

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.delete("/api/datasets/managed/test-uuid-1")
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"]["error"] == "dataset_in_use"
    assert len(data["detail"]["referencing_charts"]) == 1


# ── Test: no sync imports in managed_datasets module ────────────


def test_no_sync_imports():
    """Verify managed_datasets module has no DatasetSyncService references."""
    import app.api.managed_datasets as mod

    source = inspect.getsource(mod)
    assert "DatasetSyncService" not in source
    assert "dataset_sync" not in source
    assert "sync_service" not in source
    assert "superset_id" not in source
    assert "sync_status" not in source


# ── Test: get dataset 404 ───────────────────────────────────────


def test_get_managed_dataset_unknown_id_returns_404():
    """Verify 404 for unknown dataset ID."""
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed/nonexistent")
    assert resp.status_code == 404


# ── Test: references endpoint ───────────────────────────────────


def test_get_dataset_references_returns_can_delete():
    """Verify references endpoint returns can_delete with no refs."""
    row = _make_dataset_row()

    session = AsyncMock()
    # First call returns dataset, second returns empty charts, third returns empty kpis
    dataset_result = MagicMock()
    dataset_result.scalar_one_or_none = MagicMock(return_value=row)

    empty_scalars = MagicMock()
    empty_scalars.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

    session.execute = AsyncMock(side_effect=[dataset_result, empty_scalars, empty_scalars])

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/datasets/managed/test-uuid-1/references")
    assert resp.status_code == 200
    data = resp.json()
    assert data["canDelete"] is True
    assert data["referencingCharts"] == []
