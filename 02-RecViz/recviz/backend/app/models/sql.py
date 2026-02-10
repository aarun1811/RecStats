from typing import Any

from pydantic import BaseModel

from app.models.base import CamelModel


class SqlExecuteRequest(BaseModel):
    database_id: int
    sql: str
    schema_name: str | None = None
    limit: int = 1000


class SqlColumnInfo(CamelModel):
    """Matches frontend columns: { name: string; type: string }[]."""

    name: str
    type: str


class SqlQueryMeta(CamelModel):
    """Matches frontend query: { executionTime: number; rowCount: number }."""

    execution_time: float
    row_count: int


class SqlExecuteResponse(CamelModel):
    """Matches frontend SqlExecuteResponse type."""

    data: list[dict[str, Any]]
    columns: list[SqlColumnInfo]
    query: SqlQueryMeta


class DatabaseResponse(BaseModel):
    id: int
    name: str
    backend: str
    allow_dml: bool = False
    expose_in_sqllab: bool = True


class DatabaseListResponse(BaseModel):
    databases: list[DatabaseResponse]
    count: int
