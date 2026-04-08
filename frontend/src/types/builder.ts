import type { ChartLayout, FilterConfig } from '@/types/dashboard-config'

export type BuilderItemType = 'chart' | 'kpi' | 'grid'

export interface BuilderChartRef {
  chartId: string
  chartType: string
  datasetId: string
  title: string
  crossFilter: boolean
  drillHierarchy: string[]
  drillDetailDataSourceId: string | null
  refreshInterval: number | null
}

export interface BuilderKpiRef {
  kpiId: string
  title: string
}

export interface BuilderGridRef {
  datasetId: string
  title: string
  visibleColumns: string[] | null
  defaultSortColumn: string | null
  defaultSortDirection: 'asc' | 'desc'
  rowLimit: number
}

export interface BuilderItem {
  id: string
  type: BuilderItemType
  layout: ChartLayout
  chart?: BuilderChartRef
  kpi?: BuilderKpiRef
  grid?: BuilderGridRef
}

export interface BuilderState {
  dashboardId: string | null
  name: string
  description: string
  items: BuilderItem[]
  filters: FilterConfig[]
  isDirty: boolean
}
