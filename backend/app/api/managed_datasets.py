"""CRUD endpoints for RecViz-managed datasets."""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select

from app.core.dependencies import DbSessionDep
from app.core.errors import sanitize_detail
from app.db.models.dataset import RecvizDataset
from app.models.managed_dataset import (
    DatasetCreate,
    DatasetDeleteCheck,
    DatasetResponse,
    DatasetUpdate,
)
from app.services.dataset_sync import DatasetSyncService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/datasets/managed", tags=["managed-datasets"])


# ── Dependency ───────────────────────────────────────────────────


def get_dataset_sync(request: Request) -> DatasetSyncService:
    return request.app.state.dataset_sync


DatasetSyncDep = Annotated[DatasetSyncService, Depends(get_dataset_sync)]


def _to_response(ds: RecvizDataset) -> DatasetResponse:
    """Convert a SQLAlchemy model to a Pydantic response."""
    return DatasetResponse(
        id=ds.id,
        name=ds.name,
        description=ds.description,
        database_id=ds.database_id,
        superset_id=ds.superset_id,
        sql=ds.sql,
        columns=ds.columns,
        sync_status=ds.sync_status,
        schema_version=ds.schema_version,
        created_at=ds.created_at,
        updated_at=ds.updated_at,
    )


# ── Endpoints ────────────────────────────────────────────────────


@router.get("", response_model=list[DatasetResponse])
async def list_managed_datasets(session: DbSessionDep):
    """List all RecViz-managed datasets."""
    stmt = select(RecvizDataset).order_by(RecvizDataset.updated_at.desc())
    result = await session.execute(stmt)
    datasets = result.scalars().all()
    return [_to_response(ds) for ds in datasets]


@router.post("", response_model=DatasetResponse, status_code=201)
async def create_managed_dataset(
    body: DatasetCreate,
    session: DbSessionDep,
    sync_service: DatasetSyncDep,
):
    """Create a new RecViz-managed dataset and sync to Superset."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    dataset = RecvizDataset(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        database_id=body.database_id,
        sql=body.sql,
        columns=[col.model_dump(by_alias=True) for col in body.columns],
        sync_status="unsynced",
        schema_version=1,
        created_at=now,
        updated_at=now,
    )

    session.add(dataset)
    await session.flush()

    # Attempt Superset sync (non-blocking on failure)
    superset_id = await sync_service.sync_dataset(dataset)
    if superset_id is not None:
        dataset.superset_id = superset_id
        dataset.sync_status = "synced"
    else:
        dataset.sync_status = "error"

    return _to_response(dataset)


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_managed_dataset(dataset_id: str, session: DbSessionDep):
    """Get a single managed dataset by ID."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = await session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return _to_response(dataset)


@router.put("/{dataset_id}", response_model=DatasetResponse)
async def update_managed_dataset(
    dataset_id: str,
    body: DatasetUpdate,
    session: DbSessionDep,
    sync_service: DatasetSyncDep,
):
    """Update a managed dataset and re-sync to Superset."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = await session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Apply non-None fields
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "columns" and value is not None:
            value = [
                col.model_dump(by_alias=True) if hasattr(col, "model_dump") else col
                for col in body.columns  # type: ignore[union-attr]
            ]
        setattr(dataset, field, value)

    dataset.sync_status = "unsynced"
    await session.flush()

    # Attempt re-sync
    superset_id = await sync_service.sync_dataset(dataset)
    if superset_id is not None:
        dataset.superset_id = superset_id
        dataset.sync_status = "synced"
    else:
        dataset.sync_status = "error"

    return _to_response(dataset)


@router.delete("/{dataset_id}", status_code=204)
async def delete_managed_dataset(
    dataset_id: str,
    session: DbSessionDep,
    sync_service: DatasetSyncDep,
):
    """Delete a managed dataset after checking references."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = await session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Check for referencing charts (Phase 6 will populate this)
    referencing_charts: list[dict] = []
    if referencing_charts:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "dataset_in_use",
                "message": "Cannot delete dataset referenced by charts",
                "referencing_charts": referencing_charts,
            },
        )

    # Delete from Superset (non-blocking)
    await sync_service.delete_synced(dataset.superset_id)

    # Delete from DB
    await session.delete(dataset)

    return Response(status_code=204)


@router.get("/{dataset_id}/references", response_model=DatasetDeleteCheck)
async def get_dataset_references(dataset_id: str, session: DbSessionDep):
    """Check what references a dataset (charts, etc.)."""
    stmt = select(RecvizDataset).where(RecvizDataset.id == dataset_id)
    result = await session.execute(stmt)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Placeholder: Phase 6 will add real chart reference checks
    return DatasetDeleteCheck(can_delete=True, referencing_charts=[])
