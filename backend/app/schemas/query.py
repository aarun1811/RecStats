"""Pydantic schemas for queries."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class QueryCreate(BaseModel):
    """Schema for creating a query."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sql_text: str = Field(..., min_length=1)
    data_source_id: Optional[str] = None


class QueryUpdate(BaseModel):
    """Schema for updating a query."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    sql_text: Optional[str] = Field(None, min_length=1)
    data_source_id: Optional[str] = None


class QueryResponse(BaseModel):
    """Schema for query response."""

    id: str
    name: str
    description: Optional[str] = None
    sql_text: str
    data_source_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QueryExecuteRequest(BaseModel):
    """Schema for executing a query."""

    sql: str = Field(..., min_length=1)
    data_source_id: str
    limit: int = Field(default=1000, ge=1, le=100000)
    offset: int = Field(default=0, ge=0)
    parameters: Optional[dict[str, Any]] = None


class ColumnMetadata(BaseModel):
    """Metadata for a result column."""

    name: str
    data_type: str


class QueryExecuteResponse(BaseModel):
    """Schema for query execution response."""

    columns: list[ColumnMetadata]
    data: list[dict[str, Any]]
    row_count: int
    total_count: Optional[int] = None
    execution_time_ms: float
    truncated: bool = False
