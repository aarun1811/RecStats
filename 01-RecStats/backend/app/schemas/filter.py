"""Pydantic schemas for dashboard filters."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class FilterType(str, Enum):
    """Supported filter types."""

    SELECT = "select"
    MULTI_SELECT = "multi-select"
    RANGE = "range"
    DATE_RANGE = "date-range"
    TEXT = "text"


class FilterOperator(str, Enum):
    """Filter operators for different filter types."""

    EQ = "="
    NE = "!="
    GT = ">"
    LT = "<"
    GTE = ">="
    LTE = "<="
    IN = "IN"
    NOT_IN = "NOT IN"
    BETWEEN = "BETWEEN"
    LIKE = "LIKE"
    CONTAINS = "CONTAINS"


class FilterOption(BaseModel):
    """Option for select/multi-select filters."""

    value: str | int | float
    label: str
    count: Optional[int] = None


# ============================================================================
# Filter Chart Mapping Schemas
# ============================================================================


class FilterChartMappingCreate(BaseModel):
    """Schema for creating a filter-chart mapping."""

    chart_id: str
    column_name: str
    operator: FilterOperator = FilterOperator.EQ
    enabled: bool = True


class FilterChartMappingUpdate(BaseModel):
    """Schema for updating a filter-chart mapping."""

    column_name: Optional[str] = None
    operator: Optional[FilterOperator] = None
    enabled: Optional[bool] = None


class FilterChartMappingResponse(BaseModel):
    """Response schema for filter-chart mapping."""

    id: str
    filter_id: str
    chart_id: str
    chart_name: Optional[str] = None
    column_name: str
    operator: FilterOperator
    enabled: bool

    class Config:
        from_attributes = True


# ============================================================================
# Dashboard Filter Schemas
# ============================================================================


class FilterCreate(BaseModel):
    """Schema for creating a dashboard filter."""

    dashboard_id: str
    name: str = Field(..., min_length=1, max_length=100)
    filter_type: FilterType
    values_query: Optional[str] = None
    static_options: Optional[list[FilterOption]] = None
    data_source_id: Optional[str] = None
    default_value: Optional[Any] = None
    placeholder: Optional[str] = None
    required: bool = False
    display_order: int = 0
    min_value: Optional[str] = None
    max_value: Optional[str] = None
    chart_mappings: Optional[list[FilterChartMappingCreate]] = None


class FilterUpdate(BaseModel):
    """Schema for updating a dashboard filter."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    filter_type: Optional[FilterType] = None
    values_query: Optional[str] = None
    static_options: Optional[list[FilterOption]] = None
    data_source_id: Optional[str] = None
    default_value: Optional[Any] = None
    placeholder: Optional[str] = None
    required: Optional[bool] = None
    display_order: Optional[int] = None
    min_value: Optional[str] = None
    max_value: Optional[str] = None


class FilterResponse(BaseModel):
    """Response schema for dashboard filter."""

    id: str
    dashboard_id: str
    name: str
    filter_type: FilterType
    values_query: Optional[str] = None
    static_options: Optional[list[FilterOption]] = None
    data_source_id: Optional[str] = None
    default_value: Optional[Any] = None
    placeholder: Optional[str] = None
    required: bool
    display_order: int
    min_value: Optional[str] = None
    max_value: Optional[str] = None
    chart_mappings: list[FilterChartMappingResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Filter Values Schemas
# ============================================================================


class FilterValuesRequest(BaseModel):
    """Request to execute a filter values query."""

    values_query: str
    data_source_id: Optional[str] = None
    limit: int = 1000


class FilterValuesResponse(BaseModel):
    """Response with filter value options."""

    filter_id: Optional[str] = None
    options: list[FilterOption]
    execution_time_ms: float


# ============================================================================
# Applied Filter Schemas (for filtering chart data)
# ============================================================================


class AppliedFilter(BaseModel):
    """A filter applied to chart data."""

    column: str
    operator: FilterOperator
    value: Any


class FilteredChartDataRequest(BaseModel):
    """Request for filtered chart data."""

    filters: list[AppliedFilter] = []


class FilteredChartDataResponse(BaseModel):
    """Response with filtered chart data."""

    chart_id: str
    data: list[dict[str, Any]]
    columns: list[dict[str, str]]
    applied_filters: list[AppliedFilter]
    execution_time_ms: float


# ============================================================================
# Reorder Filters Schema
# ============================================================================


class ReorderFiltersRequest(BaseModel):
    """Request to reorder filters."""

    filter_ids: list[str]
