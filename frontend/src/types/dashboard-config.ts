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
  /** Visual treatment for the trend badge.
   *  - 'delta' (default): time-series-style — coloured left border (green ↑ /
   *    red ↓), arrow icon, '+' prefix on positives. Use when the percentage
   *    represents a CHANGE (e.g. month-over-month).
   *  - 'ratio': neutral pill — muted background, no arrow, no '+' prefix, no
   *    border tint. Use when the percentage is a STATIC RATIO between two
   *    KPIs (e.g. break rate = breaks / records). Avoids implying a positive
   *    or negative movement when no movement is being expressed. */
  display?: 'delta' | 'ratio'
}

export interface KpiConfig {
  id: string
  label: string
  format: 'number' | 'currency' | 'percent'
  sources: KpiSource[]
  aggregation: string
  trend?: KpiTrend
  visibleWhen?: VisibleWhen
  /** Optional CSS custom-property name (e.g. `--chart-positive`, `--series-8`)
   * used as the card's accent — drives the left-border color, the trend pill
   * background tint, and the trend pill text color. When set it overrides the
   * default derivation (which colors the border from trend sign). Use this to
   * give domain meaning to a card regardless of its trend semantics — e.g.
   * "Breaks" stays amber even though its percentage_of value is positive. The
   * token must be defined in the theme's index.css. */
  accentColor?: string
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
  visibleWhen?: VisibleWhen
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
  /** When merging multiple sources, fill missing numeric cells in left-only /
   *  right-only rows with `0` instead of leaving them absent/null. Consumed
   *  by MergedSourceGrid → useDataSourceMerge → backend MergeRequest. */
  coalesceZero?: boolean
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
