export interface FilterOptionsSource {
  dataSourceId: string
  valueColumn: string
  dependsOn: Record<string, string>
}

export interface FilterPresetOption {
  label: string
  value: number | string
}

export interface FilterConfig {
  id: string
  label: string
  type: 'single-select' | 'multi-select' | 'preset-range'
  lockable: boolean
  optionsSource?: FilterOptionsSource
  options?: FilterPresetOption[]
  defaultValue?: number | string
}

export interface KpiSource {
  dataSourceId: string
  metric: string
}

export interface KpiTrend {
  type: string
  referenceKpi: string
}

export interface KpiConfig {
  id: string
  label: string
  format: 'number' | 'currency' | 'percent'
  sources: KpiSource[]
  aggregation: string
  trend?: KpiTrend
}

export interface KpiSegment {
  kpiId: string
  label: string
  color: string
}

export interface ChartLayout {
  col: number
  row: number
  width: number
  height: number
}

export interface ChartSource {
  dataSourceId: string
  metric?: string
  label?: string
}

export interface DashboardChartConfig {
  id: string
  title: string
  type: string
  sourceType: 'query' | 'kpi_values'
  /** Reference to a chart in the chart library. When present, the view renderer
   *  fetches the stored chart config to resolve metricColumns, categoryColumn,
   *  and appearance — so the dashboard JSON doesn't need to duplicate them. */
  chartId?: string
  sources?: ChartSource[]
  kpiSegments?: KpiSegment[]
  layout: ChartLayout
  crossFilter?: boolean
  drillHierarchy?: string[]
  drillDetailDataSourceId?: string
  /** Per-chart refresh interval override in milliseconds. undefined = use dashboard default. */
  refreshInterval?: number
  /** Appearance overrides (colorRange, legend, labels) — passed through to chart renderer.
   *  Takes precedence over library chart appearance when both are present. */
  appearance?: {
    colorRange?: string[]
    showLegend?: boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    showXLabel?: boolean
    showYLabel?: boolean
    typeSpecific?: Record<string, unknown>
  }
}

export interface GridColumn {
  field: string
  header: string
  type: 'string' | 'number' | 'date'
}

export interface GridSource {
  dataSourceId: string
}

export interface VisibleWhen {
  kpi: string
  condition: 'gt' | 'lt' | 'eq'
  value: number
}

export interface GridConfig {
  id: string
  title: string
  dataSourceId?: string
  sources?: GridSource[]
  mergeOn?: string[]
  mergeType?: string
  columns: GridColumn[]
  visibleWhen?: VisibleWhen
  layout: ChartLayout
  crossFilterColumn?: string
}

export interface DashboardFeatures {
  crossFilter: boolean
  drillDown: boolean
}

export interface DashboardLayoutConfig {
  type: string
  sections: string[]
}

export interface DashboardConfig {
  id: string
  name: string
  description: string
  features: DashboardFeatures
  filters: FilterConfig[]
  kpis: KpiConfig[]
  charts: DashboardChartConfig[]
  grids: GridConfig[]
  layout: DashboardLayoutConfig
  /** Auto-refresh interval in milliseconds. 0 = disabled. Default: 600000 (10 min). */
  autoRefreshInterval?: number
}

export interface KpiResult {
  id: string
  value: number
  percentage?: number
}

export interface KpisResponse {
  kpis: KpiResult[]
}

export interface DataSourceQueryResponse {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  truncated: boolean
}

export interface DistinctValuesResponse {
  values: string[]
}
