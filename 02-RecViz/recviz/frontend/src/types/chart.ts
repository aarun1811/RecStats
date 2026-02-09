export type ChartLibrary = 'ag-charts' | 'echarts'

export type AgChartType =
  | 'line' | 'bar' | 'area' | 'pie' | 'donut'
  | 'scatter' | 'bubble' | 'histogram' | 'heatmap'
  | 'treemap' | 'waterfall' | 'bullet' | 'box-plot'
  | 'range-bar' | 'range-area' | 'candlestick' | 'combo'

export type EChartType =
  | 'sankey' | 'sunburst' | 'radar' | 'graph'
  | 'gauge' | 'parallel' | 'funnel'

export type ChartType = AgChartType | EChartType

export interface ChartConfig {
  id: string
  title: string
  type: ChartType
  library: ChartLibrary
  datasetId?: number
  superset_chart_id?: number
  options: Record<string, unknown>
}

export interface ChartClickEvent {
  field: string
  value: string | number
  data: Record<string, unknown>
}

export interface ChartDataResponse {
  data: Record<string, unknown>[]
  columns: string[]
  rowCount: number
}
