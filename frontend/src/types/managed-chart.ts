export type LibraryChartType =
  | 'bar'
  | 'stacked-bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'heatmap'
  | 'treemap'
  | 'waterfall'
  | 'bullet'
  | 'box-plot'
  | 'combo'
  | 'sankey'
  | 'sunburst'
  | 'radar'
  | 'gauge'
  | 'funnel'
  | 'graph'
  | 'parallel'

export interface ChartColumnMapping {
  categoryColumn: string | null
  metricColumns: string[]
  aggregations: Record<string, string>
}

export interface ChartAppearance {
  title: string
  showLegend: boolean
  legendPosition: 'top' | 'bottom' | 'left' | 'right'
  showXLabel: boolean
  showYLabel: boolean
  typeSpecific?: Record<string, unknown>
}

export interface ChartLibraryConfig {
  columnMapping: ChartColumnMapping
  appearance: ChartAppearance
}

export interface RecvizChart {
  id: string
  name: string
  description: string
  datasetId: string
  chartType: LibraryChartType
  config: ChartLibraryConfig
  createdAt: string
  updatedAt: string
}

export interface ChartCreate {
  name: string
  description: string
  datasetId: string
  chartType: LibraryChartType
  config: ChartLibraryConfig
}

export interface ChartUpdate {
  name?: string
  description?: string
  chartType?: LibraryChartType
  config?: ChartLibraryConfig
}

export interface ChartDeleteCheck {
  canDelete: boolean
  referencingDashboards: { id: string; name: string }[]
}
