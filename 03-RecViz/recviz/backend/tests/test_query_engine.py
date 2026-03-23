import pytest
from app.services.query_engine import QueryEngine
from app.services.config_store import ConfigStore


@pytest.fixture
def engine():
    store = ConfigStore()
    return QueryEngine(config_store=store, superset_client=None)


def test_build_sql_with_filters(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"recon": ["AGENT_01"], "date_range": 1},
    )
    assert "b.agent_code IN ('AGENT_01')" in sql
    assert "flag_2 = 0" in sql


def test_build_sql_no_filters(engine):
    sql = engine._build_sql(data_source_id="tlm_breaks", filters={})
    assert "{{filters}}" not in sql
    assert "flag_2 = 0" in sql


def test_resolve_database_dynamic(engine):
    db_id = engine._resolve_database(
        data_source_id="tlm_breaks",
        filters={"tlm_instance": "TLMP_CONSUMER"},
    )
    assert db_id == "superset_db_TCOSPRD"


def test_resolve_database_static(engine):
    db_id = engine._resolve_database(
        data_source_id="reconmgmt_manual",
        filters={},
    )
    assert db_id == "superset_db_reconmgmt"


def test_resolve_database_dynamic_missing_filter(engine):
    with pytest.raises(ValueError, match="required filter"):
        engine._resolve_database(
            data_source_id="tlm_breaks",
            filters={},
        )


@pytest.mark.asyncio
async def test_execute_mock(engine):
    result = await engine.execute(
        data_source_id="tlm_breaks",
        filters={"tlm_instance": "TLMP_CONSUMER", "recon": ["AGENT_01"], "date_range": 1},
    )
    assert "columns" in result
    assert "rows" in result
    assert "row_count" in result
    assert result["row_count"] >= 0


@pytest.mark.asyncio
async def test_execute_distinct_mock(engine):
    values = await engine.execute_distinct(
        data_source_id="reconmgmt_recon_bank",
        column="recon_engine_env",
        filters={},
    )
    assert isinstance(values, list)
    assert len(values) > 0


@pytest.mark.asyncio
async def test_execute_mock_max_rows_truncation(engine):
    """Verify max_rows safety parameter truncates and flags results."""
    result = await engine.execute(
        data_source_id="tlm_breaks",
        filters={"tlm_instance": "TLMP_CONSUMER", "recon": ["AGENT_01"], "date_range": 1},
        max_rows=5,
    )
    assert result["row_count"] == 5
    assert result["truncated"] is True
    assert len(result["rows"]) == 5


@pytest.mark.asyncio
async def test_execute_mock_no_truncation(engine):
    """Verify truncated is False when rows are within max_rows."""
    result = await engine.execute(
        data_source_id="tlm_breaks",
        filters={"tlm_instance": "TLMP_CONSUMER", "recon": ["AGENT_01"], "date_range": 1},
        max_rows=10_000,
    )
    assert result["truncated"] is False
    assert result["row_count"] <= 10_000
