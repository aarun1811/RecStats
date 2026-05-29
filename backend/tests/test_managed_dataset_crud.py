from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.dataset import RecvizDataset


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_create_persists_filter_mappings_and_routing(sqlite_session: Session):
    from app.api.managed_datasets import create_managed_dataset
    from app.models.managed_dataset import DatasetCreate

    body = DatasetCreate(
        name="QR Automatch",
        databaseId="conn-recportal",
        sql="SELECT * FROM quickrec_stats_table WHERE 1=1 {{filters}}",
        columns=[{"name": "recon_id", "displayName": "Recon ID", "dataType": "string", "role": "dimension"}],
        filterMappings=[{"filterId": "recon_id", "sqlExpr": "recon_id = '{{value}}'"}],
        databaseRouting={"type": "static", "database": "recportal"},
    )
    resp = create_managed_dataset(body=body, session=sqlite_session)

    assert resp.filter_mappings[0].filter_id == "recon_id"
    assert resp.database_routing.type == "static"

    stored = sqlite_session.get(RecvizDataset, resp.id)
    assert stored.filter_mappings == [{"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"}]
    assert stored.database_routing == {"type": "static", "database": "recportal"}
