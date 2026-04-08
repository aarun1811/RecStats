"""Pydantic request/response models for RecViz-managed datasets."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

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


class DatasetCreate(CamelModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=1024)
    database_id: int
    sql: str = Field(min_length=1)
    columns: list[ColumnMetaSchema]


class DatasetUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=1024)
    sql: str | None = Field(default=None, min_length=1)
    columns: list[ColumnMetaSchema] | None = None


class DatasetResponse(CamelModel):
    id: str
    name: str
    description: str
    database_id: int
    superset_id: int | None
    sql: str
    columns: list[ColumnMetaSchema]
    sync_status: str
    schema_version: int
    created_at: datetime
    updated_at: datetime


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
