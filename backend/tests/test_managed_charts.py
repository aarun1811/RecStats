"""Tests for managed chart CRUD API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


# ── Test fixtures ────────────────────────────────────────────────


def _make_chart_row(
    *,
    chart_id: str = "chart-uuid-1",
    name: str = "Test Chart",
    description: str = "A test chart",
    dataset_id: str = "dataset-uuid-1",
    chart_type: str = "bar",
    config: dict | None = None,
) -> MagicMock:
    """Create a mock RecvizChart row."""
    row = MagicMock()
    row.id = chart_id
    row.name = name
    row.description = description
    row.dataset_id = dataset_id
    row.chart_type = chart_type
    row.config = config or {
        "column_mapping": {
            "category_column": "region",
            "metric_columns": ["amount"],
            "aggregations": {"amount": "SUM"},
        },
        "appearance": {
            "title": "Test",
            "show_legend": True,
            "legend_position": "bottom",
            "show_x_label": True,
            "show_y_label": True,
        },
    }
    row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return row


def _create_test_app(session_mock: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with mocked dependencies."""
    from app.api.managed_charts import router
    from app.core.dependencies import get_db_session

    test_app = FastAPI()
    test_app.include_router(router)

    async def override_db():
        yield session_mock

    test_app.dependency_overrides[get_db_session] = override_db

    return test_app


VALID_CREATE_BODY = {
    "name": "My Chart",
    "description": "Testing",
    "datasetId": "dataset-uuid-1",
    "chartType": "bar",
    "config": {
        "columnMapping": {
            "categoryColumn": "region",
            "metricColumns": ["amount"],
            "aggregations": {"amount": "SUM"},
        },
        "appearance": {
            "title": "Revenue by Region",
            "showLegend": True,
            "legendPosition": "bottom",
            "showXLabel": True,
            "showYLabel": True,
        },
    },
}


# ── POST tests ───────────────────────────────────────────────────


def test_create_managed_chart_returns_201():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/charts/managed", json=VALID_CREATE_BODY)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Chart"
    assert data["datasetId"] == "dataset-uuid-1"
    assert data["chartType"] == "bar"
    assert "id" in data
    assert "createdAt" in data
    assert "updatedAt" in data


# ── GET list tests ───────────────────────────────────────────────


def test_list_managed_charts_returns_list():
    row = _make_chart_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[row]))
    )
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/charts/managed")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "Test Chart"


# ── GET single tests ─────────────────────────────────────────────


def test_get_managed_chart_returns_chart():
    row = _make_chart_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/charts/managed/chart-uuid-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Chart"
    assert data["id"] == "chart-uuid-1"


def test_get_managed_chart_unknown_id_returns_404():
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/charts/managed/nonexistent")
    assert resp.status_code == 404


# ── PUT tests ────────────────────────────────────────────────────


def test_update_managed_chart_returns_200():
    row = _make_chart_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.put(
        "/api/charts/managed/chart-uuid-1",
        json={"name": "Updated Chart", "chartType": "line"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Chart"


# ── DELETE tests ─────────────────────────────────────────────────


def test_delete_managed_chart_returns_204():
    row = _make_chart_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)
    session.delete = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.delete("/api/charts/managed/chart-uuid-1")
    assert resp.status_code == 204


# ── References tests ─────────────────────────────────────────────


def test_get_chart_references_returns_can_delete():
    row = _make_chart_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/charts/managed/chart-uuid-1/references")
    assert resp.status_code == 200
    data = resp.json()
    assert data["canDelete"] is True
    assert data["referencingDashboards"] == []


# ── Dataset reference check (chart blocks dataset delete) ────────


def test_dataset_references_returns_referencing_charts():
    """When charts reference a dataset, the dataset references endpoint should list them."""
    from app.api.managed_datasets import router as ds_router
    from app.core.dependencies import get_db_session
    from app.services.dataset_sync import DatasetSyncService

    ds_row = MagicMock()
    ds_row.id = "dataset-uuid-1"
    ds_row.name = "Test Dataset"
    ds_row.description = ""
    ds_row.database_id = 1
    ds_row.superset_id = 42
    ds_row.sql = "SELECT 1"
    ds_row.columns = []
    ds_row.sync_status = "synced"
    ds_row.schema_version = 1
    ds_row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ds_row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    chart_row = _make_chart_row(dataset_id="dataset-uuid-1")

    session = AsyncMock()

    # First execute: dataset lookup, second: chart reference query, third: KPI reference query
    ds_result = MagicMock()
    ds_result.scalar_one_or_none = MagicMock(return_value=ds_row)

    chart_result = MagicMock()
    chart_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[chart_row]))
    )

    kpi_result = MagicMock()
    kpi_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[]))
    )

    session.execute = AsyncMock(side_effect=[ds_result, chart_result, kpi_result])

    sync_service = MagicMock(spec=DatasetSyncService)

    test_app = FastAPI()
    test_app.include_router(ds_router)
    test_app.state.dataset_sync = sync_service

    async def override_db():
        yield session

    test_app.dependency_overrides[get_db_session] = override_db

    client = TestClient(test_app)

    resp = client.get("/api/datasets/managed/dataset-uuid-1/references")
    assert resp.status_code == 200
    data = resp.json()
    assert data["canDelete"] is False
    assert len(data["referencingCharts"]) == 1
    assert data["referencingCharts"][0]["id"] == "chart-uuid-1"


def test_dataset_delete_blocked_when_charts_reference():
    """DELETE dataset should return 409 when charts reference it."""
    from app.api.managed_datasets import router as ds_router
    from app.core.dependencies import get_db_session
    from app.services.dataset_sync import DatasetSyncService

    ds_row = MagicMock()
    ds_row.id = "dataset-uuid-1"
    ds_row.name = "Test Dataset"
    ds_row.description = ""
    ds_row.database_id = 1
    ds_row.superset_id = 42
    ds_row.sql = "SELECT 1"
    ds_row.columns = []
    ds_row.sync_status = "synced"
    ds_row.schema_version = 1
    ds_row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ds_row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    chart_row = _make_chart_row(dataset_id="dataset-uuid-1")

    session = AsyncMock()

    # First execute: dataset lookup, second: chart reference query, third: KPI reference query
    ds_result = MagicMock()
    ds_result.scalar_one_or_none = MagicMock(return_value=ds_row)

    chart_result = MagicMock()
    chart_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[chart_row]))
    )

    kpi_result = MagicMock()
    kpi_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[]))
    )

    session.execute = AsyncMock(side_effect=[ds_result, chart_result, kpi_result])
    session.delete = AsyncMock()

    sync_service = MagicMock(spec=DatasetSyncService)
    sync_service.delete_synced = AsyncMock()

    test_app = FastAPI()
    test_app.include_router(ds_router)
    test_app.state.dataset_sync = sync_service

    async def override_db():
        yield session

    test_app.dependency_overrides[get_db_session] = override_db

    client = TestClient(test_app)

    resp = client.delete("/api/datasets/managed/dataset-uuid-1")
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"]["error"] == "dataset_in_use"
