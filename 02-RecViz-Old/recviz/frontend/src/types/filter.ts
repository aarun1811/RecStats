export interface DateRange {
  from: Date
  to: Date
}

export interface GlobalFilters {
  dateRange: DateRange
  entities: string[]
  statuses: string[]
  desks: string[]
}

export interface CrossFilter {
  chartId: string
  field: string
  value: string | string[]
}

export interface DrillLevel {
  label: string
  filters: Record<string, unknown>
  granularity: 'month' | 'day' | 'category' | 'detail'
}

export interface DrillState {
  chartId: string
  levels: DrillLevel[]
  currentLevel: number
}
