from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    get_aggregation_service,
    get_elasticsearch_service,
    get_export_service,
    get_superset_client,
)
from app.core.exceptions import SupersetError
from app.main import app


@asynccontextmanager
async def _test_lifespan(app_instance):
    """Test lifespan that mocks all external services."""
    app_instance.state.superset_http = MagicMock()
    app_instance.state.elasticsearch = AsyncMock()
    app_instance.state.cache = AsyncMock()
    app_instance.state.cache.close = AsyncMock()
    app_instance.state.elasticsearch.close = AsyncMock()
    app_instance.state.superset_http.aclose = AsyncMock()
    yield


@pytest.fixture
def mock_superset_client():
    """Create a mock SupersetClient that raises NotImplementedError by default."""
    client = AsyncMock()
    client.ensure_authenticated = AsyncMock()
    client.list_charts = AsyncMock(side_effect=NotImplementedError)
    client.get_chart = AsyncMock(side_effect=NotImplementedError)
    client.get_chart_data = AsyncMock(side_effect=NotImplementedError)
    client.list_datasets = AsyncMock(side_effect=NotImplementedError)
    client.get_dataset = AsyncMock(side_effect=NotImplementedError)
    client.get_dataset_data = AsyncMock(side_effect=NotImplementedError)
    client.execute_sql = AsyncMock(side_effect=NotImplementedError)
    client.list_databases = AsyncMock(side_effect=NotImplementedError)
    return client


@pytest.fixture
def mock_es_service():
    """Create a mock ElasticsearchService."""
    service = AsyncMock()
    service.search = AsyncMock(return_value={"hits": [], "total": 0})
    return service


@pytest.fixture
def mock_export_service():
    """Create a mock ExportService."""
    service = AsyncMock()
    service.generate_pdf = AsyncMock(side_effect=SupersetError(502, "Superset unavailable"))
    service.generate_excel = AsyncMock(side_effect=SupersetError(502, "Superset unavailable"))
    return service


@pytest.fixture
def mock_aggregation_service():
    """Create a mock AggregationService."""
    service = AsyncMock()
    service.weighted_aging = AsyncMock(side_effect=NotImplementedError)
    service.rolling_recon_rate = AsyncMock(side_effect=NotImplementedError)
    service.break_velocity = AsyncMock(side_effect=NotImplementedError)
    return service


@pytest.fixture
def client(
    mock_superset_client,
    mock_es_service,
    mock_export_service,
    mock_aggregation_service,
):
    """Create TestClient with all service dependencies overridden."""
    # Replace lifespan to avoid needing real external services
    original_lifespan = app.router.lifespan_context
    app.router.lifespan_context = _test_lifespan

    app.dependency_overrides[get_superset_client] = lambda: mock_superset_client
    app.dependency_overrides[get_elasticsearch_service] = lambda: mock_es_service
    app.dependency_overrides[get_export_service] = lambda: mock_export_service
    app.dependency_overrides[get_aggregation_service] = lambda: mock_aggregation_service

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()
    app.router.lifespan_context = original_lifespan
