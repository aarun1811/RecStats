from __future__ import annotations

from pydantic import BaseModel


class DatabaseRoutingMapping(BaseModel):
    type: str  # "static" | "dynamic"
    database: str | None = None
    route_by_filter: str | None = None
    mapping: dict[str, str] | None = None


class FilterMapping(BaseModel):
    filter_id: str
    sql_expr: str


class ColumnDef(BaseModel):
    name: str
    type: str  # "string" | "number" | "date"
    label: str | None = None


class DataSourceConfig(BaseModel):
    id: str
    name: str
    database_routing: DatabaseRoutingMapping
    query: str
    filter_mappings: list[FilterMapping] = []
    columns: list[ColumnDef] = []
