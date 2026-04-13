"""CRUD endpoints for RecViz-managed datasets."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from app.core.dependencies import DbSessionDep
from app.db.models.dataset import RecvizDataset
from app.models.managed_dataset import (
    DatasetCreate,
    DatasetDeleteCheck,
    DatasetResponse,
    DatasetUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/datasets/managed", tags=["managed-datasets"])


# ── Helpers ──────────────────────────────────────────────────────


def _to_response(ds: RecvizDataset) -> DatasetResponse:
    """Convert a SQLAlchemy model to a Pydantic response.

    Note on ``description``: Oracle treats empty strings as NULL at the
    DB level (a well-known Oracle quirk). A row saved with
    ``description=""`` comes back as ``None`` on Oracle, which fails
    ``DatasetResponse.description: str`` validation. Coerce to ``""``
    here so the API contract stays ``description is always a string``.
    """
    return DatasetResponse(
        id=ds.id,
        name=ds.name,
        description=ds.description or "",
        database_id=ds.database_id,
        sql=ds.sql,
        columns=ds.columns,
        schema_version=ds.schema_version,
        created_at=ds.created_at,
        updated_at=ds.updated_at,
    )


# ── Endpoints ────────────────────────────────────────────────────


@router.get("", response_model=list[DatasetResponse])
def list_managed_datasets(session: DbSessionDep):
    """List all RecViz-managed datasets."""
    stmt = select(RecvizDataset).order_by(RecvizDataset.updated_at.desc())
    result = session.execute(stmt)
    datasets = result.scalars().all()
    return [_to_response(ds) for ds in datasets]


@router.post("", response_model=DatasetResponse, status_code=201)
def create_managed_dataset(
    body: DatasetCreate,
    session: DbSessionDep,
):
    """Create a new RecViz-managed dataset."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    dataset = RecvizDataset(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description or None,
        database_id=body.database_id,
        sql=body.sql,
        columns=[col.model_dump(by_alias=True) for col in body.columns],
        schema_version=1,
        created_at=now,
        updated_at=now,
    )

    session.add(dataset)
    session.flush()

    return _to_response(dataset)


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_managed_dataset(dataset_id: str, session: DbSessionDep):
    """Get a single managed dataset by ID."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return _to_response(dataset)


@router.put("/{dataset_id}", response_model=DatasetResponse)
def update_managed_dataset(
    dataset_id: str,
    body: DatasetUpdate,
    session: DbSessionDep,
):
    """Update a managed dataset."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Apply non-None fields
    if body.name is not None:
        dataset.name = body.name
    if body.description is not None:
        dataset.description = body.description or None
    if body.sql is not None:
        dataset.sql = body.sql
    if body.columns is not None:
        dataset.columns = [col.model_dump(by_alias=True) for col in body.columns]

    return _to_response(dataset)


@router.delete("/{dataset_id}", status_code=204)
def delete_managed_dataset(
    dataset_id: str,
    session: DbSessionDep,
):
    """Delete a managed dataset after checking references."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Check for referencing charts
    from app.db.models.chart import RecvizChart

    chart_stmt = select(RecvizChart).where(RecvizChart.dataset_id == dataset_id)
    chart_result = session.execute(chart_stmt)
    referencing_charts_list = chart_result.scalars().all()
    referencing_charts = [{"id": c.id, "name": c.name} for c in referencing_charts_list]

    # Check for referencing KPIs
    from app.db.models.kpi import RecvizKpi

    kpi_stmt = select(RecvizKpi).where(RecvizKpi.dataset_id == dataset_id)
    kpi_result = session.execute(kpi_stmt)
    referencing_kpis_list = kpi_result.scalars().all()
    referencing_kpis = [{"id": k.id, "name": k.name} for k in referencing_kpis_list]

    if referencing_charts or referencing_kpis:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "dataset_in_use",
                "message": "Cannot delete dataset referenced by charts or KPIs",
                "referencing_charts": referencing_charts,
                "referencing_kpis": referencing_kpis,
            },
        )

    # Delete from DB
    session.delete(dataset)

    return Response(status_code=204)


@router.get("/{dataset_id}/references", response_model=DatasetDeleteCheck)
def get_dataset_references(dataset_id: str, session: DbSessionDep):
    """Check what references a dataset (charts, etc.)."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Check for referencing charts
    from app.db.models.chart import RecvizChart
    from app.models.managed_dataset import ReferencingChart, ReferencingKpi

    chart_stmt = select(RecvizChart).where(RecvizChart.dataset_id == dataset_id)
    chart_result = session.execute(chart_stmt)
    referencing_charts_list = chart_result.scalars().all()
    chart_refs = [ReferencingChart(id=c.id, name=c.name) for c in referencing_charts_list]

    # Check for referencing KPIs
    from app.db.models.kpi import RecvizKpi

    kpi_stmt = select(RecvizKpi).where(RecvizKpi.dataset_id == dataset_id)
    kpi_result = session.execute(kpi_stmt)
    referencing_kpis_list = kpi_result.scalars().all()
    kpi_refs = [ReferencingKpi(id=k.id, name=k.name) for k in referencing_kpis_list]

    return DatasetDeleteCheck(
        can_delete=len(chart_refs) == 0 and len(kpi_refs) == 0,
        referencing_charts=chart_refs,
        referencing_kpis=kpi_refs,
    )
