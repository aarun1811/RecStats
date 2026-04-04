import pytest
from app.services.config_store import ConfigStore


@pytest.fixture
def store():
    return ConfigStore()


def test_list_dashboards(store):
    dashboards = store.list_dashboards()
    assert len(dashboards) >= 1
    assert any(d.id == "tlm-stats" for d in dashboards)


def test_get_dashboard(store):
    config = store.get_dashboard("tlm-stats")
    assert config is not None
    assert config.id == "tlm-stats"
    assert len(config.filters) == 4
    assert len(config.kpis) == 4
    assert len(config.charts) == 1
    assert len(config.grids) == 2


def test_get_dashboard_not_found(store):
    config = store.get_dashboard("nonexistent")
    assert config is None


def test_get_data_source(store):
    ds = store.get_data_source("tlm_breaks")
    assert ds is not None
    assert ds.id == "tlm_breaks"
    assert ds.database_routing.type == "dynamic"
    assert "TLMP_CONSUMER" in ds.database_routing.mapping


def test_get_data_source_static_routing(store):
    ds = store.get_data_source("reconmgmt_manual")
    assert ds is not None
    assert ds.database_routing.type == "static"
    assert ds.database_routing.database == "superset_db_reconmgmt"


def test_get_data_source_not_found(store):
    ds = store.get_data_source("nonexistent")
    assert ds is None
