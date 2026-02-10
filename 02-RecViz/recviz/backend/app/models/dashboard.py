from typing import Any

from pydantic import BaseModel

from app.models.base import CamelModel


class ChartConfig(CamelModel):
    """Matches frontend ChartConfig type."""

    id: str
    title: str
    type: str
    library: str  # 'ag-charts' | 'echarts'
    dataset_id: int | None = None
    superset_chart_id: int | None = None
    options: dict[str, Any] = {}


class CrossFilterRule(CamelModel):
    """Matches frontend CrossFilterRule type."""

    source_chart_id: str
    source_field: str
    target_chart_ids: list[str]
    target_field: str


class DashboardLayoutItem(CamelModel):
    """Matches frontend DashboardLayoutItem type."""

    chart_id: str
    row: int
    col: int
    width: int
    height: int


class DashboardConfig(CamelModel):
    """Matches frontend DashboardConfig type."""

    id: str
    title: str
    description: str = ""
    charts: list[ChartConfig] = []
    cross_filter_rules: list[CrossFilterRule] = []
    layout: list[DashboardLayoutItem] = []


class DashboardCreate(BaseModel):
    title: str
    description: str = ""
    charts: list[ChartConfig] = []
    cross_filter_rules: list[CrossFilterRule] = []
    layout: list[DashboardLayoutItem] = []


class DashboardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    charts: list[ChartConfig] | None = None
    cross_filter_rules: list[CrossFilterRule] | None = None
    layout: list[DashboardLayoutItem] | None = None


class DashboardListResponse(CamelModel):
    dashboards: list[DashboardConfig]
    count: int
