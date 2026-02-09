from datetime import datetime

from pydantic import BaseModel

from app.models.filters import GlobalFilters


class SavedViewCreate(BaseModel):
    name: str
    filters: GlobalFilters
    layout: dict | None = None


class SavedView(BaseModel):
    id: str
    name: str
    filters: GlobalFilters
    layout: dict | None = None
    created_at: datetime
