export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'donut'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'treemap'
  | 'sankey'
  | 'sunburst'
  | 'radar'
  | 'gauge'

export interface ChartConfig {
  id: string
  name: string
  vizType: string
  datasourceId: number
  description?: string | null
  params?: Record<string, unknown>
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

export interface ChartWrapperProps {
  chartId: string
  config: ChartConfig
  data?: ChartDataResponse
  isLoading?: boolean
  error?: Error | null
  onChartClick?: (event: ChartClickEvent) => void
  className?: string
}
