"""Pydantic request/response models for RecViz-managed charts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.models.base import CamelModel


class ColumnMappingSchema(CamelModel):
    category_column: str | None = None
    metric_columns: list[str] = []
    aggregations: dict[str, str] = {}  # column_name -> aggregation function


class AppearanceSchema(CamelModel):
    title: str = ""
    show_legend: bool = True
    legend_position: Literal["top", "bottom", "left", "right"] = "bottom"
    show_x_label: bool = True
    show_y_label: bool = True


class ChartConfigSchema(CamelModel):
    column_mapping: ColumnMappingSchema = ColumnMappingSchema()
    appearance: AppearanceSchema = AppearanceSchema()


class ChartCreate(CamelModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=1024)
    dataset_id: str = Field(min_length=1)
    chart_type: str = Field(min_length=1, max_length=64)
    config: ChartConfigSchema


class ChartUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=1024)
    chart_type: str | None = Field(default=None, min_length=1, max_length=64)
    config: ChartConfigSchema | None = None


class ChartResponse(CamelModel):
    id: str
    name: str
    description: str
    dataset_id: str
    chart_type: str
    config: ChartConfigSchema
    created_at: datetime
    updated_at: datetime


class ReferencingDashboard(CamelModel):
    id: str
    name: str


class ChartDeleteCheck(CamelModel):
    can_delete: bool
    referencing_dashboards: list[ReferencingDashboard] = []
