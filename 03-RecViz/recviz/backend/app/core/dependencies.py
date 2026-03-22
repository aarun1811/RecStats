"""FastAPI dependency injection for shared services."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, Request

from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)


def get_superset_client(request: Request) -> SupersetClient | None:
    """Return the SupersetClient from app state, or None if unavailable."""
    return getattr(request.app.state, "superset", None)


SupersetDep = Annotated[SupersetClient | None, Depends(get_superset_client)]
