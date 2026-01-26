"""Queries API endpoints."""

import json
import re
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, engine
from app.db.models import Query, DataSource
from app.schemas.query import (
    QueryCreate,
    QueryUpdate,
    QueryResponse,
    QueryExecuteRequest,
    QueryExecuteResponse,
    ColumnMetadata,
    DirectQueryRequest,
    TableColumnSchema,
    TableSchema,
    SchemaResponse,
)
from app.connectors.mock import MockConnector

router = APIRouter()

# Tables allowed for direct querying (mock data tables)
ALLOWED_TABLES = {"transactions", "breaks", "daily_metrics"}

# Forbidden SQL patterns (for safety)
FORBIDDEN_PATTERNS = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bALTER\b",
    r"\bCREATE\b",
    r"\bTRUNCATE\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
]


def validate_sql(sql: str) -> None:
    """Validate SQL query for safety."""
    sql_upper = sql.upper()
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, sql_upper, re.IGNORECASE):
            raise HTTPException(
                status_code=400,
                detail=f"SQL contains forbidden keyword: {pattern.replace(chr(92), '').replace('b', '')}"
            )


def get_connector(data_source: DataSource):
    """Get the appropriate connector for a data source."""
    config = json.loads(data_source.connection_config) if data_source.connection_config else {}
    if data_source.type == "mock":
        return MockConnector(config)
    return MockConnector(config)  # Fallback to mock


@router.post("/direct", response_model=QueryExecuteResponse)
async def execute_direct_query(
    request: DirectQueryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute SQL directly against the mock data tables.

    This endpoint allows querying the transactions, breaks, and daily_metrics tables
    without requiring a data source configuration.
    """
    # Validate SQL for safety
    validate_sql(request.sql)

    start_time = time.time()

    try:
        # Execute the query
        result = await db.execute(text(request.sql))
        rows = result.fetchall()

        # Get column names and types
        columns = []
        if result.keys():
            for key in result.keys():
                columns.append(ColumnMetadata(name=key, data_type="TEXT"))

        # Convert rows to list of dicts
        data = []
        for row in rows:
            row_dict = {}
            for i, key in enumerate(result.keys()):
                value = row[i]
                # Handle datetime serialization
                if hasattr(value, "isoformat"):
                    value = value.isoformat()
                row_dict[key] = value
            data.append(row_dict)

        execution_time = (time.time() - start_time) * 1000

        return QueryExecuteResponse(
            columns=columns,
            data=data,
            row_count=len(data),
            total_count=len(data),
            execution_time_ms=round(execution_time, 2),
            truncated=False,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution failed: {str(e)}")


@router.get("/schema", response_model=SchemaResponse)
async def get_schema(db: AsyncSession = Depends(get_db)):
    """Get database schema for the mock data tables.

    Returns table names, columns, and types for transactions, breaks, and daily_metrics.
    """
    tables = []

    for table_name in ALLOWED_TABLES:
        try:
            # Get column info using PRAGMA
            result = await db.execute(text(f"PRAGMA table_info({table_name})"))
            columns_info = result.fetchall()

            columns = []
            for col in columns_info:
                # PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
                columns.append(TableColumnSchema(
                    name=col[1],
                    type=col[2] or "TEXT",
                    nullable=not bool(col[3]),
                    primary_key=bool(col[5]),
                ))

            # Get row count
            count_result = await db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            row_count = count_result.scalar()

            tables.append(TableSchema(
                name=table_name,
                columns=columns,
                row_count=row_count,
            ))
        except Exception:
            # Table might not exist yet
            pass

    # Sort tables for consistent ordering
    tables.sort(key=lambda t: t.name)

    return SchemaResponse(tables=tables)


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
