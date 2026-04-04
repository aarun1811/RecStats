from __future__ import annotations

from app.models.base import CamelModel


class GlobalFilters(CamelModel):
    region: list[str] | None = None
    country: list[str] | None = None
    lob: list[str] | None = None
    desk: list[str] | None = None
    currency: list[str] | None = None
    status: list[str] | None = None
    counterparty: list[str] | None = None
    date_from: str | None = None
    date_to: str | None = None


class CrossFilterRule(CamelModel):
    source_chart: str
    target_charts: list[str]
    column: str


class DrillLevel(CamelModel):
    level: int
    column: str
    value: str


class ChartDataRequest(CamelModel):
    filters: GlobalFilters | None = None
    drill: list[DrillLevel] | None = None
    limit: int = 10000
