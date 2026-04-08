"""FastAPI dependency injection for shared services."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, Path, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import async_session_factory
from app.models.data_source_config import DataSourceConfig
from app.services.config_store import ConfigStore
from app.services.dataset_sync import DatasetSyncService
from app.services.query_engine import QueryEngine
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a per-request async DB session with auto commit/rollback."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]


def get_superset_client(request: Request) -> SupersetClient | None:
    """Return the SupersetClient from app state, or None if unavailable."""
    return getattr(request.app.state, "superset", None)


def get_config_store(session: DbSessionDep) -> ConfigStore:
    """Return a session-scoped ConfigStore."""
    return ConfigStore(session)


def get_query_engine(request: Request) -> QueryEngine:
    """Return the QueryEngine from app state."""
    return request.app.state.query_engine


SupersetDep = Annotated[SupersetClient | None, Depends(get_superset_client)]
ConfigStoreDep = Annotated[ConfigStore, Depends(get_config_store)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]


def get_dataset_sync(request: Request) -> DatasetSyncService:
    """Return the DatasetSyncService from app state."""
    return request.app.state.dataset_sync


DatasetSyncDep = Annotated[DatasetSyncService, Depends(get_dataset_sync)]


# --------------------------------------------------------------------------- #
# ResolvedDataSourceDep — eliminates lookup + 404 duplication across endpoints
# --------------------------------------------------------------------------- #

async def get_resolved_data_source(
    data_source_id: str = Path(...),
    config_store: ConfigStore = Depends(get_config_store),
) -> DataSourceConfig:
    """Resolve a data source config by ID, raising 404 if not found."""
    ds = await config_store.get_data_source(data_source_id)
    if ds is None:
        raise HTTPException(
            status_code=404, detail=f"Data source '{data_source_id}' not found"
        )
    return ds


ResolvedDataSourceDep = Annotated[DataSourceConfig, Depends(get_resolved_data_source)]
