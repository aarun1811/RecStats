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
  sources?: ChartSource[]
  kpiSegments?: KpiSegment[]
  layout: ChartLayout
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
