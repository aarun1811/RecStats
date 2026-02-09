from typing import Any

from pydantic import BaseModel


class CrossFilterRule(BaseModel):
    source_chart_id: int
    target_chart_ids: list[int]
    column_mapping: dict[str, str]


class ChartLayout(BaseModel):
    chart_id: int
    x: int
    y: int
    w: int
    h: int


class DashboardConfig(BaseModel):
    id: str
    name: str
    description: str = ""
    charts: list[ChartLayout]
    cross_filter_rules: list[CrossFilterRule] = []
    default_filters: dict[str, Any] = {}


class DashboardCreate(BaseModel):
    name: str
    description: str = ""
    charts: list[ChartLayout] = []
    cross_filter_rules: list[CrossFilterRule] = []
    default_filters: dict[str, Any] = {}


class DashboardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    charts: list[ChartLayout] | None = None
    cross_filter_rules: list[CrossFilterRule] | None = None
    default_filters: dict[str, Any] | None = None


class DashboardListResponse(BaseModel):
    dashboards: list[DashboardConfig]
    count: int
