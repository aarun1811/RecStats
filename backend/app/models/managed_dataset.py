"""Pydantic request/response models for RecViz-managed datasets."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import Field, field_serializer

from app.models.base import CamelModel


class ColumnMetaSchema(CamelModel):
    name: str
    display_name: str
    data_type: Literal["string", "number", "date", "currency"]
    role: Literal["dimension", "measure", "time", "none"]
    aggregation: Literal[
        "NONE", "SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"
    ] = "NONE"
    format_preset: str = "none"
    format_string: str = ""


class FilterMappingSchema(CamelModel):
    filter_id: str
    sql_expr: str


class DatabaseRoutingSchema(CamelModel):
    type: str
    database: str | None = None
    route_by_filter: str | None = None
    mapping: dict[str, str] | None = None


class DatasetCreate(CamelModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=1024)
    database_id: str
    sql: str = Field(min_length=1)
    columns: list[ColumnMetaSchema]
    filter_mappings: list[FilterMappingSchema] = []
    database_routing: DatabaseRoutingSchema | None = None


class DatasetUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=1024)
    sql: str | None = Field(default=None, min_length=1)
    columns: list[ColumnMetaSchema] | None = None
    filter_mappings: list[FilterMappingSchema] | None = None
    database_routing: DatabaseRoutingSchema | None = None


class DatasetResponse(CamelModel):
    id: str
    name: str
    description: str
    database_id: str
    sql: str
    columns: list[ColumnMetaSchema]
    schema_version: int
    created_at: datetime
    updated_at: datetime
    filter_mappings: list[FilterMappingSchema] = []
    database_routing: DatabaseRoutingSchema | None = None

    @field_serializer("created_at", "updated_at")
    def _serialize_datetime_with_utc_offset(self, dt: datetime) -> str:
        """Emit ISO 8601 with a UTC offset marker, even for naive datetimes.

        Oracle TIMESTAMP WITH TIME ZONE roundtrips via oracledb can yield
        naive Python datetimes at the Pydantic boundary. Pydantic's default
        ISO serializer drops the offset for naive datetimes, and the
        frontend's ``new Date(...)`` parses the result as local time. On
        an IST deployment that produces a ~5:30h drift → "saved 6 hours
        ago" for a just-created row.

        Assumes naive datetimes are conceptually UTC — which is true for
        RecViz since every Python call site uses ``datetime.now(timezone.utc)``.
        """
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class ReferencingChart(CamelModel):
    id: str
    name: str


class ReferencingKpi(CamelModel):
    id: str
    name: str


class DatasetDeleteCheck(CamelModel):
    can_delete: bool
    referencing_charts: list[ReferencingChart] = []
    referencing_kpis: list[ReferencingKpi] = []
