"""CRUD endpoints for RecViz-managed KPIs."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from app.core.dependencies import DbSessionDep
from app.db.models.kpi import RecvizKpi
from app.models.managed_kpi import (
    KpiConfigSchema,
    KpiCreate,
    KpiDeleteCheck,
    KpiResponse,
    KpiUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kpis/managed", tags=["managed-kpis"])


# ── Helpers ─────────────────────────────────────────────────────


def _to_response(kpi: RecvizKpi) -> KpiResponse:
    """Convert a SQLAlchemy model to a Pydantic response."""
    return KpiResponse(
        id=kpi.id,
        name=kpi.name,
        description=kpi.description,
        dataset_id=kpi.dataset_id,
        metric_column=kpi.metric_column,
        aggregation=kpi.aggregation,
        config=KpiConfigSchema(**kpi.config),
        created_at=kpi.created_at,
        updated_at=kpi.updated_at,
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.get("", response_model=list[KpiResponse])
def list_managed_kpis(session: DbSessionDep):
    """List all RecViz-managed KPIs."""
    stmt = select(RecvizKpi).order_by(RecvizKpi.updated_at.desc())
    result = session.execute(stmt)
    kpis = result.scalars().all()
    return [_to_response(k) for k in kpis]


@router.post("", response_model=KpiResponse, status_code=201)
def create_managed_kpi(
    body: KpiCreate,
    session: DbSessionDep,
):
    """Create a new RecViz-managed KPI."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    kpi = RecvizKpi(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        dataset_id=body.dataset_id,
        metric_column=body.metric_column,
        aggregation=body.aggregation,
        config=body.config.model_dump(by_alias=False),
        created_at=now,
        updated_at=now,
    )

    session.add(kpi)
    session.flush()

    return _to_response(kpi)


@router.get("/{kpi_id}", response_model=KpiResponse)
def get_managed_kpi(kpi_id: str, session: DbSessionDep):
    """Get a single managed KPI by ID."""
    stmt = select(RecvizKpi).where(RecvizKpi.id == kpi_id)
    result = session.execute(stmt)
    kpi = result.scalar_one_or_none()

    if kpi is None:
        raise HTTPException(status_code=404, detail="KPI not found")

    return _to_response(kpi)


@router.put("/{kpi_id}", response_model=KpiResponse)
def update_managed_kpi(
    kpi_id: str,
    body: KpiUpdate,
    session: DbSessionDep,
):
    """Update a managed KPI."""
    stmt = select(RecvizKpi).where(RecvizKpi.id == kpi_id)
    result = session.execute(stmt)
    kpi = result.scalar_one_or_none()

    if kpi is None:
        raise HTTPException(status_code=404, detail="KPI not found")

    # Apply non-None fields
    if body.name is not None:
        kpi.name = body.name
    if body.description is not None:
        kpi.description = body.description
    if body.metric_column is not None:
        kpi.metric_column = body.metric_column
    if body.aggregation is not None:
        kpi.aggregation = body.aggregation
    if body.config is not None:
        kpi.config = body.config.model_dump(by_alias=False)

    return _to_response(kpi)


@router.delete("/{kpi_id}", status_code=204)
def delete_managed_kpi(kpi_id: str, session: DbSessionDep):
    """Delete a managed KPI."""
    stmt = select(RecvizKpi).where(RecvizKpi.id == kpi_id)
    result = session.execute(stmt)
    kpi = result.scalar_one_or_none()

    if kpi is None:
        raise HTTPException(status_code=404, detail="KPI not found")

    session.delete(kpi)

    return Response(status_code=204)


@router.get("/{kpi_id}/references", response_model=KpiDeleteCheck)
def get_kpi_references(kpi_id: str, session: DbSessionDep):
    """Check what references a KPI (dashboards, etc.)."""
    stmt = select(RecvizKpi).where(RecvizKpi.id == kpi_id)
    result = session.execute(stmt)
    kpi = result.scalar_one_or_none()

    if kpi is None:
        raise HTTPException(status_code=404, detail="KPI not found")

    # Placeholder: Phase 8 will add real dashboard reference checks
    return KpiDeleteCheck(can_delete=True, referencing_dashboards=[])
