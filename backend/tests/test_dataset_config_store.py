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
