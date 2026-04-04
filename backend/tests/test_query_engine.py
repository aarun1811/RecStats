import pytest
from unittest.mock import MagicMock

from app.services.query_engine import QueryEngine
from app.services.config_store import ConfigStore


@pytest.fixture
def mock_registrar():
    registrar = MagicMock()
    registrar.get_dialect.return_value = "oracle"
    registrar.get_schema.return_value = ""
    registrar.get_all_schemas.return_value = {"reconmgmt"}
    return registrar


@pytest.fixture
def engine(mock_registrar):
    return QueryEngine(
        config_store=ConfigStore(),
        superset_client=MagicMock(),
        database_registrar=mock_registrar,
    )


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


def test_build_sql_sqlite_dialect(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"date_range": 7},
        dialect="sqlite",
    )
    assert "date('now', '-7 days')" in sql
    assert "SYSDATE" not in sql


def test_build_sql_oracle_dialect(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"date_range": 1},
        dialect="oracle",
    )
    assert "TRUNC(SYSDATE)" in sql
    assert "DECODE" in sql


def test_schema_stripping_for_sqlite(engine, mock_registrar):
    """When target DB has no schema, schema prefixes are stripped."""
    mock_registrar.get_schema.return_value = ""
    mock_registrar.get_all_schemas.return_value = {"reconmgmt"}
    sql = engine._build_sql(
        data_source_id="reconmgmt_manual",
        filters={},
        dialect="sqlite",
        db_name="superset_db_reconmgmt",
    )
    # The query in reconmgmt_manual has "reconmgmt.mr_csum_man_match_stats_hist"
    # Schema prefix should be stripped when target DB has no schema
    assert "reconmgmt." not in sql
    assert "mr_csum_man_match_stats_hist" in sql


def test_schema_kept_for_oracle(engine, mock_registrar):
    """When target DB has a schema, schema prefixes are preserved."""
    mock_registrar.get_schema.return_value = "reconmgmt"
    mock_registrar.get_all_schemas.return_value = {"reconmgmt"}
    sql = engine._build_sql(
        data_source_id="reconmgmt_manual",
        filters={},
        dialect="oracle",
        db_name="superset_db_reconmgmt",
    )
    assert "reconmgmt.mr_csum_man_match_stats_hist" in sql


def test_build_sql_escapes_single_quotes(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"recon": ["O'Brien"]},
    )
    assert "O''Brien" in sql
    assert "O'Brien" not in sql


def test_build_sql_invalid_column_raises(engine):
    with pytest.raises(ValueError, match="not in data source"):
        engine._build_sql(
            data_source_id="reconmgmt_recon_bank",
            filters={},
            column="malicious_column",
        )
