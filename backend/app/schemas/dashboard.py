"""Pydantic schemas for dashboards."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class FilterConfig(BaseModel):
    """Configuration for a dashboard filter."""

    field: str
    label: str
    type: str = "select"  # select, multiselect, daterange, text
    default_value: Optional[Any] = None
    options: Optional[list[dict[str, Any]]] = None  # For select/multiselect


class DashboardChartCreate(BaseModel):
    """Schema for adding a chart to a dashboard."""

    chart_id: str
    position_x: int = Field(default=0, ge=0)
    position_y: int = Field(default=0, ge=0)
    width: int = Field(default=4, ge=1, le=12)
    height: int = Field(default=3, ge=1, le=12)
    config: Optional[dict[str, Any]] = None  # Override chart config


class DashboardChartUpdate(BaseModel):
    """Schema for updating a chart on a dashboard."""

    position_x: Optional[int] = Field(None, ge=0)
    position_y: Optional[int] = Field(None, ge=0)
    width: Optional[int] = Field(None, ge=1, le=12)
    height: Optional[int] = Field(None, ge=1, le=12)
    config: Optional[dict[str, Any]] = None


class DashboardChartResponse(BaseModel):
    """Schema for dashboard chart response."""

    id: str
    chart_id: str
    position_x: int
    position_y: int
    width: int
    height: int
    config: Optional[dict[str, Any]] = None

    class Config:
        from_attributes = True


class DashboardCreate(BaseModel):
    """Schema for creating a dashboard."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    layout: Optional[dict[str, Any]] = None
    filters: Optional[list[FilterConfig]] = None


class DashboardUpdate(BaseModel):
    """Schema for updating a dashboard."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    layout: Optional[dict[str, Any]] = None
    filters: Optional[list[FilterConfig]] = None


class DashboardResponse(BaseModel):
    """Schema for dashboard response."""

    id: str
    name: str
    description: Optional[str] = None
    layout: dict[str, Any]
    filters: Optional[list[dict[str, Any]]] = None
    created_at: datetime
    updated_at: datetime
    charts: list[DashboardChartResponse] = []

    class Config:
        from_attributes = True


class DashboardFullResponse(BaseModel):
    """Schema for dashboard with full chart data."""

    dashboard: DashboardResponse
    chart_data: dict[str, Any]  # chart_id -> data
