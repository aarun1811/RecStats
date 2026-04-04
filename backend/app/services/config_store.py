from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.dashboard import RecvizDashboard
from app.db.models.data_source import RecvizDataSource
from app.models.dashboard_config import DashboardConfig
from app.models.data_source_config import DataSourceConfig
from app.services.config_migrator import migrate_config


class ConfigStore:
    """DB-backed config store. One instance per request (session-scoped)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_dashboards(self) -> list[DashboardConfig]:
        result = await self._session.execute(
            select(RecvizDashboard).order_by(RecvizDashboard.name)
        )
        rows = result.scalars().all()
        return [
            DashboardConfig.model_validate(migrate_config(row.config))
            for row in rows
        ]

    async def get_dashboard(self, dashboard_id: str) -> DashboardConfig | None:
        row = await self._session.get(RecvizDashboard, dashboard_id)
        if not row:
            return None
        return DashboardConfig.model_validate(migrate_config(row.config))

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
