"""CRUD endpoints for RecViz-managed dashboards."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from app.core.dependencies import DbSessionDep
from app.db.models.dashboard import RecvizDashboard
from app.models.managed_dashboard import (
    DashboardCreate,
    DashboardResponse,
    DashboardUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboards/managed", tags=["managed-dashboards"])


# ── Helpers ─────────────────────────────────────────────────────


def _to_response(dashboard: RecvizDashboard) -> DashboardResponse:
    """Convert a SQLAlchemy model to a Pydantic response.

    Note on ``description``: Oracle treats empty strings as NULL at the
    DB level (a well-known Oracle quirk). A row saved with
    ``description=""`` comes back as ``None`` on Oracle, which fails
    ``DashboardResponse.description: str`` validation. Coerce to ``""``
    here — same fix as managed_kpis / managed_datasets / managed_charts.
    """
    return DashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description or "",
        config=dashboard.config,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.get("", response_model=list[DashboardResponse])
def list_managed_dashboards(session: DbSessionDep):
    """List all RecViz-managed dashboards."""
    stmt = select(RecvizDashboard).order_by(RecvizDashboard.updated_at.desc())
    result = session.execute(stmt)
    dashboards = result.scalars().all()
    return [_to_response(d) for d in dashboards]


@router.post("", response_model=DashboardResponse, status_code=201)
def create_managed_dashboard(
    body: DashboardCreate,
    session: DbSessionDep,
):
    """Create a new RecViz-managed dashboard."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    dashboard = RecvizDashboard(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        config=body.config,
        created_at=now,
        updated_at=now,
    )

    session.add(dashboard)
    session.flush()

    return _to_response(dashboard)


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_managed_dashboard(dashboard_id: str, session: DbSessionDep):
    """Get a single managed dashboard by ID."""
    stmt = select(RecvizDashboard).where(RecvizDashboard.id == dashboard_id)
    result = session.execute(stmt)
    dashboard = result.scalar_one_or_none()

    if dashboard is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    return _to_response(dashboard)


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_managed_dashboard(
    dashboard_id: str,
    body: DashboardUpdate,
    session: DbSessionDep,
):
    """Update a managed dashboard."""
    stmt = select(RecvizDashboard).where(RecvizDashboard.id == dashboard_id)
    result = session.execute(stmt)
    dashboard = result.scalar_one_or_none()

    if dashboard is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Apply non-None fields
    if body.name is not None:
        dashboard.name = body.name
    if body.description is not None:
        dashboard.description = body.description
    if body.config is not None:
        dashboard.config = body.config

    return _to_response(dashboard)


@router.delete("/{dashboard_id}", status_code=204)
def delete_managed_dashboard(dashboard_id: str, session: DbSessionDep):
    """Delete a managed dashboard."""
    stmt = select(RecvizDashboard).where(RecvizDashboard.id == dashboard_id)
    result = session.execute(stmt)
    dashboard = result.scalar_one_or_none()

    if dashboard is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    session.delete(dashboard)

    return Response(status_code=204)
