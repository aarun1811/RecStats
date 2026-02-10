import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from app.models.views import SavedView, SavedViewCreate

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory view storage (mock — real impl uses sidecar Oracle DB)
_views: dict[str, SavedView] = {}


@router.get("", response_model=list[SavedView])
async def list_views() -> list[SavedView]:
    """List all saved views for current user."""
    return list(_views.values())


@router.post("", response_model=SavedView, status_code=201)
async def create_view(body: SavedViewCreate) -> SavedView:
    """Save a new view."""
    view_id = str(uuid.uuid4())[:8]
    view = SavedView(
        id=view_id,
        name=body.name,
        filters=body.filters,
        layout=body.layout,
        created_at=datetime.now(UTC),
    )
    _views[view_id] = view
    logger.info("Created view %s: %s", view_id, body.name)
    return view


@router.get("/{view_id}", response_model=SavedView)
async def get_view(view_id: str) -> SavedView:
    """Get a saved view by ID."""
    view = _views.get(view_id)
    if not view:
        raise HTTPException(status_code=404, detail=f"View {view_id} not found")
    return view


@router.delete("/{view_id}", status_code=204)
async def delete_view(view_id: str) -> None:
    """Delete a saved view."""
    if view_id not in _views:
        raise HTTPException(status_code=404, detail=f"View {view_id} not found")
    del _views[view_id]
    logger.info("Deleted view %s", view_id)
