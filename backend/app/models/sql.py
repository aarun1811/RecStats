from typing import Any

from pydantic import BaseModel


class SqlExecuteRequest(BaseModel):
    database_id: int
    sql: str
    schema_name: str | None = None
    limit: int = 1000


class SqlExecuteResponse(BaseModel):
    columns: list[str]
    data: list[dict[str, Any]]
    row_count: int
    query_id: str | None = None


class DatabaseResponse(BaseModel):
    id: int
    name: str
    backend: str
    allow_dml: bool = False
    expose_in_sqllab: bool = True


class DatabaseListResponse(BaseModel):
    databases: list[DatabaseResponse]
    count: int
