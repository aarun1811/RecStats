export type ChartType =
  | 'line'
  | 'bar'
  | 'stacked-bar'
  | 'pie'
  | 'donut'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'treemap'
  | 'waterfall'
  | 'combo'
  | 'histogram'
  | 'sankey'
  | 'sunburst'
  | 'radar'
  | 'gauge'
  | 'funnel'
  | 'graph'
  | 'parallel'

export interface ChartConfig {
  id: string
  name: string
  vizType: string
  datasourceId: number
  description?: string | null
  params?: Record<string, unknown>
  /** Config-driven column mapping (D-02): metric columns from DashboardChartConfig.sources[].metric */
  metricColumns: string[]
  /** Config-driven column mapping (D-02): explicit category column, resolved at render time if omitted */
  categoryColumn?: string
}

export interface ChartDataResponse {
  chartId: string
  columns: string[]
  data: Record<string, unknown>[]
  rowCount: number
}

export interface ChartClickEvent {
  chartId: string
  column: string
  value: string | number
  row: Record<string, unknown>
}

/** Active selection highlight for source chart of a cross-filter. */
export interface ChartSelection {
  column: string
  value: string | number
}

export interface ChartWrapperProps {
  chartId: string
  config: ChartConfig
  data?: ChartDataResponse
  isLoading?: boolean
  error?: Error | null
  onChartClick?: (event: ChartClickEvent) => void
  onChartDoubleClick?: (event: ChartClickEvent) => void
  /** When set, the chart highlights the selected segment and dims the rest. */
  activeSelection?: ChartSelection
  className?: string
}
