"""CRUD endpoints for RecViz-managed charts."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from app.core.dependencies import DbSessionDep
from app.db.models.chart import RecvizChart
from app.models.managed_chart import (
    ChartConfigSchema,
    ChartCreate,
    ChartDeleteCheck,
    ChartResponse,
    ChartUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/charts/managed", tags=["managed-charts"])


# ── Helpers ─────────────────────────────────────────────────────


def _to_response(chart: RecvizChart) -> ChartResponse:
    """Convert a SQLAlchemy model to a Pydantic response.

    Note on ``description``: Oracle treats empty strings as NULL at the
    DB level (a well-known Oracle quirk). A row saved with
    ``description=""`` comes back as ``None`` on Oracle, which fails
    ``ChartResponse.description: str`` validation. Coerce to ``""``
    here so the API contract stays ``description is always a string``.
    """
    return ChartResponse(
        id=chart.id,
        name=chart.name,
        description=chart.description or "",
        dataset_id=chart.dataset_id,
        chart_type=chart.chart_type,
        config=ChartConfigSchema(**chart.config),
        created_at=chart.created_at,
        updated_at=chart.updated_at,
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.get("", response_model=list[ChartResponse])
def list_managed_charts(session: DbSessionDep):
    """List all RecViz-managed charts."""
    stmt = select(RecvizChart).order_by(RecvizChart.updated_at.desc())
    result = session.execute(stmt)
    charts = result.scalars().all()
    return [_to_response(c) for c in charts]


@router.post("", response_model=ChartResponse, status_code=201)
def create_managed_chart(
    body: ChartCreate,
    session: DbSessionDep,
):
    """Create a new RecViz-managed chart."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    chart = RecvizChart(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description or None,
        dataset_id=body.dataset_id,
        chart_type=body.chart_type,
        config=body.config.model_dump(by_alias=False),
        created_at=now,
        updated_at=now,
    )

    session.add(chart)
    session.flush()

    return _to_response(chart)


@router.get("/{chart_id}", response_model=ChartResponse)
def get_managed_chart(chart_id: str, session: DbSessionDep):
    """Get a single managed chart by ID."""
    stmt = select(RecvizChart).where(RecvizChart.id == chart_id)
    result = session.execute(stmt)
    chart = result.scalar_one_or_none()

    if chart is None:
        raise HTTPException(status_code=404, detail="Chart not found")

    return _to_response(chart)


@router.put("/{chart_id}", response_model=ChartResponse)
def update_managed_chart(
    chart_id: str,
    body: ChartUpdate,
    session: DbSessionDep,
):
    """Update a managed chart."""
    stmt = select(RecvizChart).where(RecvizChart.id == chart_id)
    result = session.execute(stmt)
    chart = result.scalar_one_or_none()

    if chart is None:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Apply non-None fields
    if body.name is not None:
        chart.name = body.name
    if body.description is not None:
        chart.description = body.description or None
    if body.chart_type is not None:
        chart.chart_type = body.chart_type
    if body.config is not None:
        chart.config = body.config.model_dump(by_alias=False)

    return _to_response(chart)


@router.delete("/{chart_id}", status_code=204)
def delete_managed_chart(chart_id: str, session: DbSessionDep):
    """Delete a managed chart."""
    stmt = select(RecvizChart).where(RecvizChart.id == chart_id)
    result = session.execute(stmt)
    chart = result.scalar_one_or_none()

    if chart is None:
        raise HTTPException(status_code=404, detail="Chart not found")

    session.delete(chart)

    return Response(status_code=204)


@router.get("/{chart_id}/references", response_model=ChartDeleteCheck)
def get_chart_references(chart_id: str, session: DbSessionDep):
    """Check what references a chart (dashboards, etc.)."""
    stmt = select(RecvizChart).where(RecvizChart.id == chart_id)
    result = session.execute(stmt)
    chart = result.scalar_one_or_none()

    if chart is None:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Placeholder: Phase 8 will add real dashboard reference checks
    return ChartDeleteCheck(can_delete=True, referencing_dashboards=[])
