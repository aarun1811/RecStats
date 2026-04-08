from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.data_source import RecvizDataSource
from app.models.data_source_config import DataSourceConfig
from app.services.config_migrator import migrate_config


class ConfigStore:
    """DB-backed data source config store. One instance per request (session-scoped).

    Dashboard CRUD lives in `managed_dashboards` router (Phase 8+) and reads
    `RecvizDashboard.config` as a raw JSONB dict — no Pydantic validation,
    because the shape is defined by the frontend builder and is evolving.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_data_source(self, data_source_id: str) -> DataSourceConfig | None:
        row = await self._session.get(RecvizDataSource, data_source_id)
        if not row:
            return None
        return DataSourceConfig.model_validate(migrate_config(row.config))

    async def list_data_sources(self) -> list[DataSourceConfig]:
        result = await self._session.execute(
            select(RecvizDataSource).order_by(RecvizDataSource.name)
        )
        rows = result.scalars().all()
        return [
            DataSourceConfig.model_validate(migrate_config(row.config))
            for row in rows
        ]
