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

/** Imperative handle exposed by AgChartWrapper via forwardRef. */
export interface AgChartRef {
  /** Download chart as PNG image. Uses AG Charts native download(). */
  download: (fileName: string) => void
  /** Get chart as data URL for custom processing. */
  getImageDataURL: () => Promise<string>
  /** Get underlying chart data for CSV/clipboard export. */
  getData: () => { columns: string[]; rows: Record<string, unknown>[] } | null
}

/** Imperative handle exposed by EChartWrapper via forwardRef. */
export interface EChartRef {
  /** Get chart as data URL. type: 'png' | 'svg'. pixelRatio defaults to 2 for consistent retina output. */
  getDataURL: (opts: { type: 'png' | 'svg'; pixelRatio?: number }) => string | null
  /** Get underlying chart data for CSV/clipboard export. */
  getData: () => { columns: string[]; rows: Record<string, unknown>[] } | null
}

/** Unified chart ref consumed by ChartToolbar. Abstracts AG Charts vs ECharts. */
export interface ChartRef {
  /** Download chart as image. format: 'png' or 'svg'. SVG only available for ECharts. */
  downloadImage: (format: 'png' | 'svg', fileName: string) => void
  /** Export underlying data as CSV file download. */
  exportCSV: (fileName: string) => void
  /** Copy underlying data to clipboard as tab-separated text. */
  copyToClipboard: () => Promise<void>
  /** Whether SVG export is supported (true for ECharts, false for AG Charts). */
  supportsSVG: boolean
}
