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

export interface DrillLevel {
  column: string
  value: string
  label?: string
}

export interface ChartDrillState {
  levels: DrillLevel[]
  hierarchy: string[]
  detailDataSourceId?: string
}

export type FilterValue = string | string[] | number

export interface FilterState {
  values: Record<string, FilterValue>
  locked: Set<string>
  applied: Record<string, FilterValue>
}
