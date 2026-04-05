from __future__ import annotations

from pydantic import BaseModel


class FilterOptionsSource(BaseModel):
    data_source_id: str
    value_column: str
    depends_on: dict[str, str] = {}


class FilterPresetOption(BaseModel):
    label: str
    value: int | str


class FilterConfig(BaseModel):
    id: str
    label: str
    type: str  # "single-select" | "multi-select" | "preset-range"
    lockable: bool = False
    options_source: FilterOptionsSource | None = None
    options: list[FilterPresetOption] | None = None
    default_value: int | str | None = None


class KpiSource(BaseModel):
    data_source_id: str
    metric: str


class KpiTrend(BaseModel):
    type: str  # "percentage_of"
    reference_kpi: str


class KpiConfig(BaseModel):
    id: str
    label: str
    format: str  # "number" | "currency" | "percent"
    sources: list[KpiSource]
    aggregation: str = "sum"
    trend: KpiTrend | None = None


class KpiSegment(BaseModel):
    kpi_id: str
    label: str
    color: str


class ChartLayout(BaseModel):
    col: int
    row: int
    width: int
    height: int


class ChartSource(BaseModel):
    data_source_id: str
    metric: str | None = None
    label: str | None = None


class DashboardChartConfig(BaseModel):
    id: str
    title: str
    type: str
    source_type: str = "query"  # "query" | "kpi_values"
    sources: list[ChartSource] | None = None
    kpi_segments: list[KpiSegment] | None = None
    layout: ChartLayout
    cross_filter: bool | None = None  # None = participates (default), False = opt-out
    drill_hierarchy: list[str] | None = None
    drill_detail_data_source_id: str | None = None


class GridSource(BaseModel):
    data_source_id: str


class GridColumn(BaseModel):
    field: str
    header: str
    type: str = "string"  # "string" | "number" | "date"


class VisibleWhen(BaseModel):
    kpi: str
    condition: str  # "gt" | "lt" | "eq"
    value: int | float


class GridConfig(BaseModel):
    id: str
    title: str
    data_source_id: str | None = None
    sources: list[GridSource] | None = None
    merge_on: list[str] | None = None
    merge_type: str | None = None
    columns: list[GridColumn]
    visible_when: VisibleWhen | None = None
    layout: ChartLayout
    cross_filter_column: str | None = None


class DashboardFeatures(BaseModel):
    cross_filter: bool = False
    drill_down: bool = False


class LayoutConfig(BaseModel):
    type: str = "flow"
    sections: list[str] = ["filters", "kpis", "charts", "grids"]


class DashboardConfig(BaseModel):
    id: str
    name: str
    description: str = ""
    features: DashboardFeatures = DashboardFeatures()
    filters: list[FilterConfig] = []
    kpis: list[KpiConfig] = []
    charts: list[DashboardChartConfig] = []
    grids: list[GridConfig] = []
    layout: LayoutConfig = LayoutConfig()
