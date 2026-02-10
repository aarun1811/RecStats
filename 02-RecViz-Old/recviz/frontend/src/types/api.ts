export interface ApiListResponse<T> {
  count: number
  result: T[]
}

export interface SqlExecuteRequest {
  databaseId: number
  sql: string
  schema?: string
  limit?: number
}

export interface SqlExecuteResponse {
  data: Record<string, unknown>[]
  columns: { name: string; type: string }[]
  query: {
    executionTime: number
    rowCount: number
  }
}

export interface ExportRequest {
  format: 'pdf' | 'excel'
  dashboardId: string
  filters: Record<string, unknown>
  options?: {
    title?: string
    includeCharts?: boolean
    includeGrid?: boolean
  }
}

export interface DashboardConfig {
  id: string
  title: string
  description?: string
  charts: import('./chart').ChartConfig[]
  crossFilterRules: CrossFilterRule[]
  layout: DashboardLayoutItem[]
}

export interface CrossFilterRule {
  sourceChartId: string
  sourceField: string
  targetChartIds: string[]  // ["*"] for all
  targetField: string
}

export interface DashboardLayoutItem {
  chartId: string
  row: number
  col: number
  width: number   // grid columns (out of 12)
  height: number  // grid rows
}

export interface SearchResult {
  type: 'dashboard' | 'chart' | 'dataset'
  id: string
  title: string
  description?: string
}

export interface QueryHistoryItem {
  id: string
  sql: string
  databaseId: number
  schema?: string
  executionTime: number
  rowCount: number
  status: 'success' | 'error'
  errorMessage?: string
  createdAt: string
}

export interface ExportStatusResponse {
  status: 'pending' | 'processing' | 'complete' | 'error'
  url?: string
  error?: string
}
