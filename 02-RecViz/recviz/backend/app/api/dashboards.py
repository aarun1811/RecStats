import logging
import uuid

from fastapi import APIRouter, HTTPException

from app.mock.data import MOCK_DASHBOARDS
from app.models.dashboard import (
    DashboardConfig,
    DashboardCreate,
    DashboardUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store for dashboards (mock — real impl uses sidecar Oracle DB)
_dashboards: dict[str, DashboardConfig] = dict(MOCK_DASHBOARDS)


@router.get("")
async def list_dashboards() -> dict:
    """List all dashboard configs."""
    dashboards = list(_dashboards.values())
    return {
        "dashboards": [d.model_dump(by_alias=True) for d in dashboards],
        "count": len(dashboards),
    }


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str) -> dict:
    """Get a specific dashboard config."""
    dashboard = _dashboards.get(dashboard_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail=f"Dashboard {dashboard_id} not found")
    return dashboard.model_dump(by_alias=True)


@router.post("", status_code=201)
async def create_dashboard(body: DashboardCreate) -> dict:
    """Create a new dashboard config."""
    dashboard_id = str(uuid.uuid4())[:8]
    dashboard = DashboardConfig(
        id=dashboard_id,
        title=body.title,
        description=body.description,
        charts=body.charts,
        cross_filter_rules=body.cross_filter_rules,
        layout=body.layout,
    )
    _dashboards[dashboard_id] = dashboard
    logger.info("Created dashboard %s: %s", dashboard_id, body.title)
    return dashboard.model_dump(by_alias=True)


@router.put("/{dashboard_id}")
async def update_dashboard(dashboard_id: str, body: DashboardUpdate) -> dict:
    """Update an existing dashboard config."""
    existing = _dashboards.get(dashboard_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Dashboard {dashboard_id} not found")

    update_data = body.model_dump(exclude_unset=True)
    updated = existing.model_copy(update=update_data)
    _dashboards[dashboard_id] = updated
    logger.info("Updated dashboard %s", dashboard_id)
    return updated.model_dump(by_alias=True)
