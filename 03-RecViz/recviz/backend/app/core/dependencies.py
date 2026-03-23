"""FastAPI dependency injection for shared services."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, Request

from app.services.config_store import ConfigStore
from app.services.query_engine import QueryEngine
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)


def get_superset_client(request: Request) -> SupersetClient | None:
    """Return the SupersetClient from app state, or None if unavailable."""
    return getattr(request.app.state, "superset", None)


def get_config_store(request: Request) -> ConfigStore:
    """Return the ConfigStore from app state."""
    return request.app.state.config_store


def get_query_engine(request: Request) -> QueryEngine:
    """Return the QueryEngine from app state."""
    return request.app.state.query_engine


SupersetDep = Annotated[SupersetClient | None, Depends(get_superset_client)]
ConfigStoreDep = Annotated[ConfigStore, Depends(get_config_store)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]
