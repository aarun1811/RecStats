import type { ChartConfig } from './chart'
import type { CrossFilterRule } from './filter'

export interface DashboardLayoutItem {
  chartId: string
  x: number
  y: number
  w: number
  h: number
}

export interface DashboardConfig {
  id: string
  title: string
  slug: string
  description?: string | null
  charts: ChartConfig[]
  layout: DashboardLayoutItem[]
  crossFilterRules: CrossFilterRule[]
  defaultFilters: Record<string, string[]>
}

export interface DashboardListItem {
  id: string
  title: string
  slug: string
  description?: string | null
}
