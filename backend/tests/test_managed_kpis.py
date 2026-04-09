"""Tests for managed KPI CRUD API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


# ── Test fixtures ────────────────────────────────────────────────


def _make_kpi_row(
    *,
    kpi_id: str = "kpi-uuid-1",
    name: str = "Test KPI",
    description: str = "A test KPI",
    dataset_id: str = "dataset-uuid-1",
    metric_column: str = "amount",
    aggregation: str = "SUM",
    config: dict | None = None,
) -> MagicMock:
    """Create a mock RecvizKpi row."""
    row = MagicMock()
    row.id = kpi_id
    row.name = name
    row.description = description
    row.dataset_id = dataset_id
    row.metric_column = metric_column
    row.aggregation = aggregation
    row.config = config or {
        "format": {
            "type": "number",
            "decimals": None,
            "abbreviate": True,
            "currency_code": None,
        },
        "trend": None,
        "thresholds": None,
        "subtitle": "",
    }
    row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return row


def _create_test_app(session_mock: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with mocked dependencies."""
    from app.api.managed_kpis import router
    from app.core.dependencies import get_db_session

    test_app = FastAPI()
    test_app.include_router(router)

    async def override_db():
        yield session_mock

    test_app.dependency_overrides[get_db_session] = override_db

    return test_app


VALID_CREATE_BODY = {
    "name": "My KPI",
    "description": "Testing",
    "datasetId": "dataset-uuid-1",
    "metricColumn": "amount",
    "aggregation": "SUM",
    "config": {
        "format": {
            "type": "number",
            "decimals": None,
            "abbreviate": True,
            "currencyCode": None,
        },
        "trend": None,
        "thresholds": None,
        "subtitle": "",
    },
}


# ── Test 1: POST creates a KPI and returns 201 ──────────────────


def test_create_managed_kpi_returns_201():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/kpis/managed", json=VALID_CREATE_BODY)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My KPI"
    assert data["datasetId"] == "dataset-uuid-1"
    assert data["metricColumn"] == "amount"
    assert data["aggregation"] == "SUM"
    assert "id" in data
    assert "config" in data
    assert "createdAt" in data
    assert "updatedAt" in data


# ── Test 2: GET list returns KPIs ordered by updated_at desc ────


def test_list_managed_kpis_returns_list():
    row = _make_kpi_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[row]))
    )
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/kpis/managed")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "Test KPI"


# ── Test 3: GET single returns a KPI ────────────────────────────


def test_get_managed_kpi_returns_kpi():
    row = _make_kpi_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/kpis/managed/kpi-uuid-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test KPI"
    assert data["id"] == "kpi-uuid-1"


# ── Test 4: GET single returns 404 for nonexistent ──────────────


def test_get_managed_kpi_unknown_id_returns_404():
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/kpis/managed/nonexistent")
    assert resp.status_code == 404


# ── Test 5: PUT updates fields ──────────────────────────────────


def test_update_managed_kpi_returns_200():
    row = _make_kpi_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.put(
        "/api/kpis/managed/kpi-uuid-1",
        json={"name": "Updated KPI", "aggregation": "AVG"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated KPI"


# ── Test 6: DELETE returns 204 ──────────────────────────────────


def test_delete_managed_kpi_returns_204():
    row = _make_kpi_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)
    session.delete = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.delete("/api/kpis/managed/kpi-uuid-1")
    assert resp.status_code == 204


# ── Test 7: GET references returns canDelete=true when no dashboards ──


def test_get_kpi_references_returns_can_delete():
    row = _make_kpi_row()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=row)
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/kpis/managed/kpi-uuid-1/references")
    assert resp.status_code == 200
    data = resp.json()
    assert data["canDelete"] is True
    assert data["referencingDashboards"] == []


# ── Test 8: Dataset references includes referencing KPIs ────────


def test_dataset_references_returns_referencing_kpis():
    """When KPIs reference a dataset, the dataset references endpoint should list them."""
    from app.api.managed_datasets import router as ds_router
    from app.core.dependencies import get_db_session

    ds_row = MagicMock()
    ds_row.id = "dataset-uuid-1"
    ds_row.name = "Test Dataset"
    ds_row.description = ""
    ds_row.database_id = 1
    ds_row.sql = "SELECT 1"
    ds_row.columns = []
    ds_row.schema_version = 1
    ds_row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ds_row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    kpi_row = _make_kpi_row(dataset_id="dataset-uuid-1")

    session = AsyncMock()

    # First execute: dataset lookup, second: chart reference query, third: KPI reference query
    ds_result = MagicMock()
    ds_result.scalar_one_or_none = MagicMock(return_value=ds_row)

    chart_result = MagicMock()
    chart_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[]))
    )

    kpi_result = MagicMock()
    kpi_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[kpi_row]))
    )

    session.execute = AsyncMock(side_effect=[ds_result, chart_result, kpi_result])

    test_app = FastAPI()
    test_app.include_router(ds_router)

    async def override_db():
        yield session

    test_app.dependency_overrides[get_db_session] = override_db

    client = TestClient(test_app)

    resp = client.get("/api/datasets/managed/dataset-uuid-1/references")
    assert resp.status_code == 200
    data = resp.json()
    assert data["canDelete"] is False
    assert len(data["referencingKpis"]) == 1
    assert data["referencingKpis"][0]["id"] == "kpi-uuid-1"


# ── Test 9: Dataset delete returns 409 when KPIs reference it ───


def test_dataset_delete_blocked_when_kpis_reference():
    """DELETE dataset should return 409 when KPIs reference it (even if no charts)."""
    from app.api.managed_datasets import router as ds_router
    from app.core.dependencies import get_db_session

    ds_row = MagicMock()
    ds_row.id = "dataset-uuid-1"
    ds_row.name = "Test Dataset"
    ds_row.description = ""
    ds_row.database_id = 1
    ds_row.sql = "SELECT 1"
    ds_row.columns = []
    ds_row.schema_version = 1
    ds_row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    ds_row.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    kpi_row = _make_kpi_row(dataset_id="dataset-uuid-1")

    session = AsyncMock()

    # First execute: dataset lookup, second: chart reference query (empty), third: KPI reference query
    ds_result = MagicMock()
    ds_result.scalar_one_or_none = MagicMock(return_value=ds_row)

    chart_result = MagicMock()
    chart_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[]))
    )

    kpi_result = MagicMock()
    kpi_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[kpi_row]))
    )

    session.execute = AsyncMock(side_effect=[ds_result, chart_result, kpi_result])
    session.delete = AsyncMock()

    test_app = FastAPI()
    test_app.include_router(ds_router)

    async def override_db():
        yield session

    test_app.dependency_overrides[get_db_session] = override_db

    client = TestClient(test_app)

    resp = client.delete("/api/datasets/managed/dataset-uuid-1")
    assert resp.status_code == 409
    data = resp.json()
    assert data["detail"]["error"] == "dataset_in_use"
