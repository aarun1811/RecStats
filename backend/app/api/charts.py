"""Charts API endpoints."""

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.db.models import Chart, Query, DataSource
from app.schemas.chart import (
    ChartCreate,
    ChartUpdate,
    ChartResponse,
    ChartDataResponse,
)
from app.connectors.mock import MockConnector

router = APIRouter()


def get_connector(data_source: DataSource):
    """Get the appropriate connector for a data source."""
    config = json.loads(data_source.connection_config) if data_source.connection_config else {}
    if data_source.type == "mock":
        return MockConnector(config)
    return MockConnector(config)


@router.post("", response_model=ChartResponse, status_code=status.HTTP_201_CREATED)
async def create_chart(
    data: ChartCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new chart."""
    # Verify query exists
    result = await db.execute(select(Query).where(Query.id == data.query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    chart = Chart(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        query_id=data.query_id,
        chart_type=data.chart_type.value,
        config=json.dumps(data.config.model_dump()),
    )
    db.add(chart)
    await db.commit()
    await db.refresh(chart)

    return ChartResponse(
        id=chart.id,
        name=chart.name,
        description=chart.description,
        query_id=chart.query_id,
        chart_type=chart.chart_type,
        config=json.loads(chart.config),
        created_at=chart.created_at,
        updated_at=chart.updated_at,
    )


@router.get("", response_model=list[ChartResponse])
async def list_charts(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List all charts."""
    result = await db.execute(
        select(Chart).offset(skip).limit(limit).order_by(Chart.created_at.desc())
    )
    charts = result.scalars().all()

    return [
        ChartResponse(
            id=chart.id,
            name=chart.name,
            description=chart.description,
            query_id=chart.query_id,
            chart_type=chart.chart_type,
            config=json.loads(chart.config) if chart.config else {},
            created_at=chart.created_at,
            updated_at=chart.updated_at,
        )
        for chart in charts
    ]


@router.get("/{chart_id}", response_model=ChartResponse)
async def get_chart(
    chart_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a chart by ID."""
    result = await db.execute(select(Chart).where(Chart.id == chart_id))
    chart = result.scalar_one_or_none()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    return ChartResponse(
        id=chart.id,
        name=chart.name,
        description=chart.description,
        query_id=chart.query_id,
        chart_type=chart.chart_type,
        config=json.loads(chart.config) if chart.config else {},
        created_at=chart.created_at,
        updated_at=chart.updated_at,
    )


@router.get("/{chart_id}/data", response_model=ChartDataResponse)
async def get_chart_with_data(
    chart_id: str,
    limit: int = 10000,
    db: AsyncSession = Depends(get_db),
):
    """Get a chart with its data."""
    result = await db.execute(
        select(Chart).options(selectinload(Chart.query)).where(Chart.id == chart_id)
    )
    chart = result.scalar_one_or_none()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    if not chart.query:
        raise HTTPException(status_code=400, detail="Chart has no query")

    if not chart.query.data_source_id:
        raise HTTPException(status_code=400, detail="Query has no data source")

    result = await db.execute(
        select(DataSource).where(DataSource.id == chart.query.data_source_id)
    )
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    connector = get_connector(data_source)
    try:
        query_result = await connector.execute_query(
            sql=chart.query.sql_text,
            limit=limit,
        )

        chart_response = ChartResponse(
            id=chart.id,
            name=chart.name,
            description=chart.description,
            query_id=chart.query_id,
            chart_type=chart.chart_type,
            config=json.loads(chart.config) if chart.config else {},
            created_at=chart.created_at,
            updated_at=chart.updated_at,
        )

        return ChartDataResponse(
            chart=chart_response,
            data=query_result.data,
            columns=[col for col in query_result.columns],
        )
    finally:
        await connector.close()


@router.put("/{chart_id}", response_model=ChartResponse)
async def update_chart(
    chart_id: str,
    data: ChartUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a chart."""
    result = await db.execute(select(Chart).where(Chart.id == chart_id))
    chart = result.scalar_one_or_none()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    if data.name is not None:
        chart.name = data.name
    if data.description is not None:
        chart.description = data.description
    if data.query_id is not None:
        chart.query_id = data.query_id
    if data.chart_type is not None:
        chart.chart_type = data.chart_type.value
    if data.config is not None:
        chart.config = json.dumps(data.config.model_dump())

    await db.commit()
    await db.refresh(chart)

    return ChartResponse(
        id=chart.id,
        name=chart.name,
        description=chart.description,
        query_id=chart.query_id,
        chart_type=chart.chart_type,
        config=json.loads(chart.config) if chart.config else {},
        created_at=chart.created_at,
        updated_at=chart.updated_at,
    )


@router.delete("/{chart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chart(
    chart_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a chart."""
    result = await db.execute(select(Chart).where(Chart.id == chart_id))
    chart = result.scalar_one_or_none()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    await db.delete(chart)
    await db.commit()
