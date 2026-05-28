from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection
from app.db.models.dataset import RecvizDataset


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _seed_conn(session: Session, name: str = "oracle-local") -> RecvizConnection:
    conn = RecvizConnection(
        id="conn-x", name=name, display_name="X", backend="oracle",
        host="localhost", port=1521, database_name="FREEPDB1", username="recviz",
        encrypted_password="x", schema_name="RECVIZ", status="active",
    )
    session.add(conn)
    session.flush()
    return conn


def test_dataset_persists_filter_mappings_and_routing(sqlite_session: Session):
    _seed_conn(sqlite_session)
    ds = RecvizDataset(
        id="ds-x", name="X", database_id="conn-x",
        sql="SELECT 1 FROM t WHERE 1=1 {{filters}}",
        columns=[],
        filter_mappings=[{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}],
        database_routing={"type": "static", "database": "oracle-local"},
    )
    sqlite_session.add(ds)
    sqlite_session.flush()
    sqlite_session.expire_all()

    reloaded = sqlite_session.get(RecvizDataset, "ds-x")
    assert reloaded.filter_mappings == [{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}]
    assert reloaded.database_routing == {"type": "static", "database": "oracle-local"}


from app.services.config_store import ConfigStore
from app.services.query_engine import QueryExecutor


def test_config_store_surfaces_filter_mappings_and_dynamic_routing(sqlite_session: Session):
    _seed_conn(sqlite_session)
    sqlite_session.add(RecvizDataset(
        id="ds-dyn", name="Dyn", database_id="conn-x",
        sql="SELECT 1 FROM t WHERE 1=1 {{filters}}",
        columns=[{"name": "recon_id", "type": "string"}],
        filter_mappings=[{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}],
        database_routing={"type": "dynamic", "route_by_filter": "tlm_instance",
                          "mapping": {"TLMP_CONSUMER": "tcosprd"}},
    ))
    sqlite_session.flush()

    cfg = ConfigStore(sqlite_session).get_data_source("ds-dyn")
    assert cfg.filter_mappings[0].filter_id == "recon_id"
    assert cfg.database_routing.type == "dynamic"
    assert cfg.database_routing.mapping == {"TLMP_CONSUMER": "tcosprd"}


def test_config_store_defaults_to_static_when_routing_null(sqlite_session: Session):
    _seed_conn(sqlite_session)
    sqlite_session.add(RecvizDataset(
        id="ds-legacy", name="Legacy", database_id="conn-x",
        sql="SELECT 1", columns=[], filter_mappings=None, database_routing=None,
    ))
    sqlite_session.flush()

    cfg = ConfigStore(sqlite_session).get_data_source("ds-legacy")
    assert cfg.database_routing.type == "static"
    assert cfg.database_routing.database == "oracle-local"   # = connection.name
    assert cfg.filter_mappings == []


def test_filter_mapping_narrows_generated_sql(sqlite_session: Session):
    _seed_conn(sqlite_session)
    sqlite_session.add(RecvizDataset(
        id="ds-f", name="F", database_id="conn-x",
        sql="SELECT * FROM t WHERE 1=1 {{filters}}", columns=[],
        filter_mappings=[{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}],
        database_routing={"type": "static", "database": "oracle-local"},
    ))
    sqlite_session.flush()
    cfg = ConfigStore(sqlite_session).get_data_source("ds-f")

    qe = QueryExecutor(engine_manager=None, connection_resolver=None)
    sql = qe._build_sql(cfg, {"recon_id": "RECON_42"}, dialect="sqlite")
    assert "recon_id = 'RECON_42'" in sql
    assert "{{filters}}" not in sql
