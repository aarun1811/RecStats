"""Pydantic schemas for data sources."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class DataSourceType(str, Enum):
    """Supported data source types."""

    SQLITE = "sqlite"
    ORACLE = "oracle"


class SQLiteConnectionConfig(BaseModel):
    """SQLite connection configuration."""

    database_path: str


class OracleConnectionConfig(BaseModel):
    """Oracle connection configuration."""

    host: str
    port: int = 1521
    service_name: str
    user: str
    password: str


class DataSourceCreate(BaseModel):
    """Schema for creating a data source."""

    name: str = Field(..., min_length=1, max_length=255)
    type: DataSourceType
    description: Optional[str] = None
    connection_config: Optional[dict[str, Any]] = None


class DataSourceUpdate(BaseModel):
    """Schema for updating a data source."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    connection_config: Optional[dict[str, Any]] = None


class DataSourceResponse(BaseModel):
    """Schema for data source response."""

    id: str
    name: str
    type: DataSourceType
    description: Optional[str] = None
    connection_status: str = "not_tested"
    connection_message: Optional[str] = None
    last_tested_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConnectionTestResult(BaseModel):
    """Result of testing a data source connection."""

    success: bool
    message: str
    details: Optional[dict[str, Any]] = None


class ColumnInfo(BaseModel):
    """Column metadata."""

    name: str
    data_type: str
    nullable: bool = True
    primary_key: bool = False


class TableInfo(BaseModel):
    """Table metadata."""

    name: str
    schema_name: Optional[str] = None
    columns: list[ColumnInfo] = []
    row_count: Optional[int] = None


class SchemaInfo(BaseModel):
    """Schema/database metadata."""

    tables: list[TableInfo] = []
