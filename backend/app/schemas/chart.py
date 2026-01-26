"""Pydantic schemas for charts."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ChartType(str, Enum):
    """Supported chart types."""

    BAR = "bar"
    BAR_HORIZONTAL = "bar_horizontal"
    LINE = "line"
    AREA = "area"
    PIE = "pie"
    DONUT = "donut"
    SCATTER = "scatter"
    BUBBLE = "bubble"
    GAUGE = "gauge"
    HEATMAP = "heatmap"
    TREEMAP = "treemap"
    FUNNEL = "funnel"
    RADAR = "radar"
    MAP = "map"
    SANKEY = "sankey"
    KPI = "kpi"
    TABLE = "table"


class AxisConfig(BaseModel):
    """Configuration for chart axis."""

    field: str
    label: Optional[str] = None
    format: Optional[str] = None  # number, currency, percent, date
    sort: Optional[str] = None  # asc, desc


class SeriesConfig(BaseModel):
    """Configuration for chart series."""

    field: str
    label: Optional[str] = None
    color: Optional[str] = None
    aggregation: str = "sum"  # sum, avg, count, min, max


class DrillDownLevel(BaseModel):
    """Configuration for drill-down level."""

    field: str
    label: str


class DrillDownConfig(BaseModel):
    """Configuration for drill-down functionality."""

    enabled: bool = False
    levels: list[DrillDownLevel] = []


class ChartConfig(BaseModel):
    """Chart configuration object."""

    title: Optional[str] = None
    subtitle: Optional[str] = None
    x_axis: Optional[AxisConfig] = None
    y_axis: Optional[AxisConfig] = None
    series: list[SeriesConfig] = []
    category_field: Optional[str] = None
    value_field: Optional[str] = None
    color_palette: Optional[list[str]] = None
    show_legend: bool = True
    show_tooltip: bool = True
    show_labels: bool = False
    drill_down: Optional[DrillDownConfig] = None
    custom_options: Optional[dict[str, Any]] = None  # ECharts-specific options


class ChartCreate(BaseModel):
    """Schema for creating a chart."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    query_id: str
    chart_type: ChartType
    config: ChartConfig


class ChartUpdate(BaseModel):
    """Schema for updating a chart."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    query_id: Optional[str] = None
    chart_type: Optional[ChartType] = None
    config: Optional[ChartConfig] = None


class ChartResponse(BaseModel):
    """Schema for chart response."""

    id: str
    name: str
    description: Optional[str] = None
    query_id: Optional[str] = None
    chart_type: ChartType
    config: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChartDataResponse(BaseModel):
    """Schema for chart with data response."""

    chart: ChartResponse
    data: list[dict[str, Any]]
    columns: list[dict[str, str]]
