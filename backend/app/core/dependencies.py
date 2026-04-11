"""FastAPI dependency injection for shared services.

Sync-only: see ``app/db/engine.py`` for the rationale for the async→sync
conversion. Route handlers that use ``DbSessionDep`` should be defined as
``def`` (not ``async def``) so FastAPI runs them in its threadpool rather
than blocking the event loop.
"""

from __future__ import annotations

import logging
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session

from app.db.engine import session_factory
from app.models.data_source_config import DataSourceConfig
from app.services.config_store import ConfigStore
from app.services.connection_resolver import ConnectionResolver
from app.services.engine_manager import EngineManager
from app.services.query_engine import QueryEngine

logger = logging.getLogger(__name__)


def get_db_session() -> Generator[Session, None, None]:
    """Yield a per-request sync DB session with auto commit/rollback."""
    with session_factory() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


DbSessionDep = Annotated[Session, Depends(get_db_session)]


def get_config_store(session: DbSessionDep) -> ConfigStore:
    """Return a session-scoped ConfigStore."""
    return ConfigStore(session)


def get_query_engine(request: Request) -> QueryEngine:
    """Return the QueryEngine from app state."""
    return request.app.state.query_engine


ConfigStoreDep = Annotated[ConfigStore, Depends(get_config_store)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]


def get_engine_manager(request: Request) -> EngineManager:
    """Return the EngineManager from app state."""
    return request.app.state.engine_manager


EngineManagerDep = Annotated[EngineManager, Depends(get_engine_manager)]


def get_connection_resolver(request: Request) -> ConnectionResolver:
    """Return the ConnectionResolver from app state."""
    return request.app.state.connection_resolver


ConnectionResolverDep = Annotated[ConnectionResolver, Depends(get_connection_resolver)]


# --------------------------------------------------------------------------- #
# ResolvedDataSourceDep — eliminates lookup + 404 duplication across endpoints
# --------------------------------------------------------------------------- #


def get_resolved_data_source(
    data_source_id: str = Path(...),
    config_store: ConfigStore = Depends(get_config_store),
) -> DataSourceConfig:
    """Resolve a data source config by ID, raising 404 if not found."""
    ds = config_store.get_data_source(data_source_id)
    if ds is None:
        raise HTTPException(
            status_code=404, detail=f"Data source '{data_source_id}' not found"
        )
    return ds


ResolvedDataSourceDep = Annotated[DataSourceConfig, Depends(get_resolved_data_source)]
