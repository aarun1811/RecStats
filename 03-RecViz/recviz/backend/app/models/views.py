from __future__ import annotations

from typing import Any

from app.models.base import CamelModel


class SavedView(CamelModel):
    id: str
    name: str
    dashboard_id: str
    filters: dict[str, Any] = {}
    created_at: str | None = None


class SavedViewCreate(CamelModel):
    name: str
    dashboard_id: str
    filters: dict[str, Any] = {}
