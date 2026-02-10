from __future__ import annotations

from app.models.base import CamelModel
from app.models.chart_data import ChartConfig
from app.models.filters import CrossFilterRule


class DashboardLayoutItem(CamelModel):
    chart_id: str
    x: int
    y: int
    w: int
    h: int


class DashboardConfig(CamelModel):
    id: str
    title: str
    slug: str
    description: str | None = None
    charts: list[ChartConfig] = []
    layout: list[DashboardLayoutItem] = []
    cross_filter_rules: list[CrossFilterRule] = []
    default_filters: dict[str, list[str]] = {}
