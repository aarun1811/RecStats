export interface GlobalFilters {
  region?: string[]
  country?: string[]
  lob?: string[]
  desk?: string[]
  currency?: string[]
  status?: string[]
  counterparty?: string[]
  dateFrom?: string
  dateTo?: string
}

export interface CrossFilter {
  sourceChartId: string
  column: string
  value: string | number
}

export interface CrossFilterRule {
  sourceChart: string
  targetCharts: string[]
  column: string
}

export interface DrillLevel {
  level: number
  column: string
  value: string
}

export interface DrillState {
  chartId: string
  levels: DrillLevel[]
}

export type FilterValue = string | string[] | number

export interface FilterState {
  values: Record<string, FilterValue>
  locked: Set<string>
  applied: Record<string, FilterValue>
}
