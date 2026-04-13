from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.connection import RecvizConnection
from app.db.models.dataset import RecvizDataset
from app.models.data_source_config import (
    ColumnDef,
    DatabaseRoutingMapping,
    DataSourceConfig,
)

logger = logging.getLogger(__name__)


class ConfigStore:
    """DB-backed data source config store. One instance per request (session-scoped).

    Reads from ``recviz_datasets`` + ``recviz_connections`` to build
    ``DataSourceConfig`` objects. The previous implementation read from the
    Superset-era ``recviz_data_sources`` table which was only populated by the
    seed script -- any dataset created through the UI had no matching row,
    causing dashboards to 404 at render time.

    Dashboard CRUD lives in ``managed_dashboards`` router and reads
    ``RecvizDashboard.config`` as a raw JSON dict -- no Pydantic validation,
    because the shape is defined by the frontend builder and is evolving.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def _build_config(
        self, dataset: RecvizDataset, connection: RecvizConnection
    ) -> DataSourceConfig:
        """Build a DataSourceConfig from a dataset row and its resolved connection."""
        columns: list[ColumnDef] = []
        for col in dataset.columns or []:
            if isinstance(col, dict) and "name" in col:
                columns.append(
                    ColumnDef(
                        name=col["name"],
                        type=col.get("type", "string"),
                        label=col.get("label"),
                    )
                )

        return DataSourceConfig(
            id=dataset.id,
            name=dataset.name,
            database_routing=DatabaseRoutingMapping(
                type="static",
                database=connection.name,
            ),
            query=dataset.sql,
            filter_mappings=[],
            columns=columns,
        )

    def get_data_source(self, data_source_id: str) -> DataSourceConfig | None:
        dataset = self._session.get(RecvizDataset, data_source_id)
        if not dataset:
            return None

        connection = self._session.get(RecvizConnection, dataset.database_id)
        if not connection:
            logger.warning(
                "Dataset '%s' references connection '%s' which does not exist",
                data_source_id,
                dataset.database_id,
            )
            return None

        return self._build_config(dataset, connection)

    def list_data_sources(self) -> list[DataSourceConfig]:
        datasets = (
            self._session.execute(
                select(RecvizDataset).order_by(RecvizDataset.name)
            )
            .scalars()
            .all()
        )

        # Batch-load all connections to avoid N+1 queries
        connection_ids = {ds.database_id for ds in datasets}
        connections_result = self._session.execute(
            select(RecvizConnection).where(
                RecvizConnection.id.in_(connection_ids)
            )
        )
        connection_map = {c.id: c for c in connections_result.scalars().all()}

        configs: list[DataSourceConfig] = []
        for dataset in datasets:
            connection = connection_map.get(dataset.database_id)
            if not connection:
                logger.warning(
                    "Dataset '%s' references connection '%s' which does not exist, skipping",
                    dataset.id,
                    dataset.database_id,
                )
                continue
            configs.append(self._build_config(dataset, connection))

        return configs
