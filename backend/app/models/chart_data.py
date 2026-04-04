from __future__ import annotations

from typing import Any

from app.models.base import CamelModel


class ChartConfig(CamelModel):
    id: str
    name: str
    viz_type: str
    datasource_id: int
    description: str | None = None
    params: dict[str, Any] = {}


class ChartDataResponse(CamelModel):
    chart_id: str
    columns: list[str]
    data: list[dict[str, Any]]
    row_count: int


class KpiData(CamelModel):
    total_breaks: int
    open_breaks: int
    resolution_rate: float
    avg_age_days: float
    sla_breaches: int
    total_transactions: int
    match_rate: float
    break_amount: float
