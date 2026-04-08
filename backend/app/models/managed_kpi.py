"""Pydantic request/response models for RecViz-managed KPIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.models.base import CamelModel
from app.models.managed_chart import ReferencingDashboard


class KpiFormatSchema(CamelModel):
    type: Literal["number", "currency", "percentage", "decimal"] = "number"
    decimals: int | None = None
    abbreviate: bool = True
    currency_code: str | None = None


class TrendPeriodConfig(CamelModel):
    mode: Literal["previous_period"] = "previous_period"
    period: Literal["day", "week", "month"] = "week"


class TrendTargetConfig(CamelModel):
    mode: Literal["static_target"] = "static_target"
    target_value: float
    target_label: str = ""


class ThresholdConfig(CamelModel):
    green_above: float
    amber_above: float


class KpiConfigSchema(CamelModel):
    format: KpiFormatSchema = KpiFormatSchema()
    trend: TrendPeriodConfig | TrendTargetConfig | None = None
    thresholds: ThresholdConfig | None = None
    subtitle: str = ""


class KpiCreate(CamelModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = Field(default="", max_length=1024)
    dataset_id: str = Field(min_length=1)
    metric_column: str = Field(min_length=1, max_length=256)
    aggregation: Literal["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"] = "SUM"
    config: KpiConfigSchema


class KpiUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=1024)
    metric_column: str | None = Field(default=None, min_length=1, max_length=256)
    aggregation: Literal["SUM", "AVG", "COUNT", "MIN", "MAX", "COUNT_DISTINCT"] | None = None
    config: KpiConfigSchema | None = None


class KpiResponse(CamelModel):
    id: str
    name: str
    description: str
    dataset_id: str
    metric_column: str
    aggregation: str
    config: KpiConfigSchema
    created_at: datetime
    updated_at: datetime


class KpiDeleteCheck(CamelModel):
    can_delete: bool
    referencing_dashboards: list[ReferencingDashboard] = []
