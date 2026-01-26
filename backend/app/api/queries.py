"""Queries API endpoints."""

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.db.models import Query, DataSource
from app.schemas.query import (
    QueryCreate,
    QueryUpdate,
    QueryResponse,
    QueryExecuteRequest,
    QueryExecuteResponse,
    ColumnMetadata,
)
from app.connectors.mock import MockConnector

router = APIRouter()


def get_connector(data_source: DataSource):
    """Get the appropriate connector for a data source."""
    config = json.loads(data_source.connection_config) if data_source.connection_config else {}
    if data_source.type == "mock":
        return MockConnector(config)
    return MockConnector(config)  # Fallback to mock


@router.post("/execute", response_model=QueryExecuteResponse)
async def execute_query(
    request: QueryExecuteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute a SQL query against a data source."""
    # Get data source
    result = await db.execute(select(DataSource).where(DataSource.id == request.data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    connector = get_connector(data_source)
    try:
        query_result = await connector.execute_query(
            sql=request.sql,
            limit=request.limit,
            offset=request.offset,
            parameters=request.parameters,
        )

        columns = [
            ColumnMetadata(name=col["name"], data_type=col["data_type"])
            for col in query_result.columns
        ]

        return QueryExecuteResponse(
            columns=columns,
            data=query_result.data,
            row_count=query_result.row_count,
            total_count=query_result.total_count,
            execution_time_ms=query_result.execution_time_ms,
            truncated=query_result.truncated,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution failed: {str(e)}")
    finally:
        await connector.close()


@router.post("", response_model=QueryResponse, status_code=status.HTTP_201_CREATED)
async def create_query(
    data: QueryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Save a new query."""
    query = Query(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        sql_text=data.sql_text,
        data_source_id=data.data_source_id,
    )
    db.add(query)
    await db.commit()
    await db.refresh(query)
    return query


@router.get("", response_model=list[QueryResponse])
async def list_queries(
    skip: int = 0,
    limit: int = 100,
    data_source_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """List all saved queries."""
    stmt = select(Query).offset(skip).limit(limit).order_by(Query.created_at.desc())
    if data_source_id:
        stmt = stmt.where(Query.data_source_id == data_source_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{query_id}", response_model=QueryResponse)
async def get_query(
    query_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a query by ID."""
    result = await db.execute(select(Query).where(Query.id == query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    return query


@router.put("/{query_id}", response_model=QueryResponse)
async def update_query(
    query_id: str,
    data: QueryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a query."""
    result = await db.execute(select(Query).where(Query.id == query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    if data.name is not None:
        query.name = data.name
    if data.description is not None:
        query.description = data.description
    if data.sql_text is not None:
        query.sql_text = data.sql_text
    if data.data_source_id is not None:
        query.data_source_id = data.data_source_id

    await db.commit()
    await db.refresh(query)
    return query


@router.delete("/{query_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_query(
    query_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a query."""
    result = await db.execute(select(Query).where(Query.id == query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    await db.delete(query)
    await db.commit()


@router.post("/{query_id}/execute", response_model=QueryExecuteResponse)
async def execute_saved_query(
    query_id: str,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Execute a saved query."""
    result = await db.execute(select(Query).where(Query.id == query_id))
    query = result.scalar_one_or_none()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    if not query.data_source_id:
        raise HTTPException(status_code=400, detail="Query has no data source")

    result = await db.execute(select(DataSource).where(DataSource.id == query.data_source_id))
    data_source = result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")

    connector = get_connector(data_source)
    try:
        query_result = await connector.execute_query(
            sql=query.sql_text,
            limit=limit,
            offset=offset,
        )

        columns = [
            ColumnMetadata(name=col["name"], data_type=col["data_type"])
            for col in query_result.columns
        ]

        return QueryExecuteResponse(
            columns=columns,
            data=query_result.data,
            row_count=query_result.row_count,
            total_count=query_result.total_count,
            execution_time_ms=query_result.execution_time_ms,
            truncated=query_result.truncated,
        )
    finally:
        await connector.close()
