from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.views import SavedView, SavedViewCreate

router = APIRouter(prefix="/api/views", tags=["views"])

# In-memory store
_views: dict[str, SavedView] = {}


@router.get("")
def list_views():
    return list(_views.values())


@router.post("")
def create_view(body: SavedViewCreate):
    view_id = str(uuid.uuid4())[:8]
    view = SavedView(
        id=view_id,
        name=body.name,
        dashboard_id=body.dashboard_id,
        filters=body.filters,
        created_at=datetime.now().isoformat(),
    )
    _views[view_id] = view
    return view


@router.delete("/{view_id}")
def delete_view(view_id: str):
    if view_id in _views:
        del _views[view_id]
        return {"deleted": True}
    raise HTTPException(
        status_code=404,
        detail={"error": "view_not_found", "message": f"Saved view '{view_id}' not found", "detail": None},
    )
