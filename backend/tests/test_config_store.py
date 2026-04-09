import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.config_store import ConfigStore
from app.db.models.data_source import RecvizDataSource
from app.models.data_source_config import DataSourceConfig


def _make_data_source_row(ds_id: str, name: str, config: dict) -> MagicMock:
    """Create a mock RecvizDataSource row."""
    row = MagicMock(spec=RecvizDataSource)
    row.id = ds_id
    row.name = name
    row.config = config
    return row


def _sample_config(ds_id: str = "tlm_breaks", routing_type: str = "dynamic") -> dict:
    """Return a minimal valid data source config dict."""
    base = {
        "id": ds_id,
        "name": f"Data source {ds_id}",
        "query": "SELECT * FROM breaks",
        "filter_mappings": [],
        "columns": [],
        "schema_version": 1,
    }
    if routing_type == "dynamic":
        base["database_routing"] = {
            "type": "dynamic",
            "route_by_filter": "desk",
            "mapping": {"TLMP_CONSUMER": "db-uuid-1"},
        }
    else:
        base["database_routing"] = {
            "type": "static",
            "database": "superset_db_reconmgmt",
        }
    return base


@pytest.mark.asyncio
async def test_get_data_source():
    config = _sample_config("tlm_breaks", "dynamic")
    row = _make_data_source_row("tlm_breaks", "TLM Breaks", config)

    session = AsyncMock()
    session.get = AsyncMock(return_value=row)

    store = ConfigStore(session=session)
    result = await store.get_data_source("tlm_breaks")

    assert result is not None
    assert isinstance(result, DataSourceConfig)
    assert result.id == "tlm_breaks"
    assert result.database_routing.type == "dynamic"
    assert "TLMP_CONSUMER" in result.database_routing.mapping
    session.get.assert_awaited_once_with(RecvizDataSource, "tlm_breaks")


@pytest.mark.asyncio
async def test_get_data_source_static_routing():
    config = _sample_config("reconmgmt_manual", "static")
    row = _make_data_source_row("reconmgmt_manual", "ReconMgmt Manual", config)

    session = AsyncMock()
    session.get = AsyncMock(return_value=row)

    store = ConfigStore(session=session)
    result = await store.get_data_source("reconmgmt_manual")

    assert result is not None
    assert result.database_routing.type == "static"
    assert result.database_routing.database == "superset_db_reconmgmt"


@pytest.mark.asyncio
async def test_get_data_source_not_found():
    session = AsyncMock()
    session.get = AsyncMock(return_value=None)

    store = ConfigStore(session=session)
    result = await store.get_data_source("nonexistent")

    assert result is None


@pytest.mark.asyncio
async def test_list_data_sources():
    row1 = _make_data_source_row("ds1", "Alpha", _sample_config("ds1", "dynamic"))
    row2 = _make_data_source_row("ds2", "Beta", _sample_config("ds2", "static"))

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [row1, row2]

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)

    store = ConfigStore(session=session)
    results = await store.list_data_sources()

    assert len(results) == 2
    assert all(isinstance(r, DataSourceConfig) for r in results)
    assert results[0].id == "ds1"
    assert results[1].id == "ds2"


@pytest.mark.asyncio
async def test_list_data_sources_empty():
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)

    store = ConfigStore(session=session)
    results = await store.list_data_sources()

    assert results == []
