"""Data sources API endpoints."""

import json
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.db.models import DataSource
from app.schemas.datasource import (
    DataSourceCreate,
    DataSourceUpdate,
    DataSourceResponse,
    ConnectionTestResult,
    SchemaInfo,
)
from app.connectors.mock import MockConnector

router = APIRouter()


def get_connector(data_source: DataSource):
    """Get the appropriate connector for a data source."""
    config = json.loads(data_source.connection_config) if data_source.connection_config else {}

    if data_source.type == "mock":
        return MockConnector(config)
    # TODO: Add oracle, hive connectors
    else:
        return MockConnector(config)  # Fallback to mock for now


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    data: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new data source."""
    data_source = DataSource(
        id=str(uuid4()),
        name=data.name,
        type=data.type.value,
        description=data.description,
        connection_config=json.dumps(data.connection_config) if data.connection_config else None,
    )
    db.add(data_source)
    await db.commit()
    await db.refresh(data_source)
    return data_source


@router.get("", response_model=list[DataSourceResponse])
async def list_data_sources(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List all data sources."""
    result = await db.execute(
        select(DataSource).offset(skip).limit(limit).order_by(DataSource.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{data_source_id}", response_model=DataSourceResponse)
async def get_data_source(
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a data source by ID."""
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")
    return data_source


@router.put("/{data_source_id}", response_model=DataSourceResponse)
async def update_data_source(
    data_source_id: str,
    data: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a data source."""
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    if data.name is not None:
        data_source.name = data.name
    if data.description is not None:
        data_source.description = data.description
    if data.connection_config is not None:
        data_source.connection_config = json.dumps(data.connection_config)

    await db.commit()
    await db.refresh(data_source)
    return data_source


@router.delete("/{data_source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a data source."""
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    await db.delete(data_source)
    await db.commit()


@router.post("/{data_source_id}/test", response_model=ConnectionTestResult)
async def test_connection(
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Test a data source connection."""
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    connector = get_connector(data_source)
    try:
        success, message = await connector.test_connection()
        return ConnectionTestResult(success=success, message=message)
    except Exception as e:
        return ConnectionTestResult(success=False, message=str(e))
    finally:
        await connector.close()


@router.get("/{data_source_id}/schema", response_model=SchemaInfo)
async def get_schema(
    data_source_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get schema information for a data source."""
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    connector = get_connector(data_source)
    try:
        schema = await connector.get_schema()
        return schema
    finally:
        await connector.close()
