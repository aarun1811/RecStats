from __future__ import annotations

from app.models.base import CamelModel


class ColumnInfo(CamelModel):
    name: str
    type: str
    is_dimension: bool = True
    is_metric: bool = False
    filterable: bool = True


class DatasetInfo(CamelModel):
    id: int
    name: str
    table_name: str
    database_id: int
    columns: list[ColumnInfo] = []
    row_count: int | None = None


class SchemaNode(CamelModel):
    name: str
    tables: list[str] = []


class SchemaTree(CamelModel):
    database_name: str
    schemas: list[SchemaNode] = []
