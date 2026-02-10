export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  rowCount: number
  page: number
  pageSize: number
}

export interface KpiData {
  totalBreaks: number
  openBreaks: number
  resolutionRate: number
  avgAgeDays: number
  slaBreaches: number
  totalTransactions: number
  matchRate: number
  breakAmount: number
}

export interface SqlResult {
  status: 'success' | 'error'
  columns: string[]
  data: Record<string, unknown>[]
  rowCount: number
  error?: string
}

export interface SqlHistoryItem {
  sql: string
  databaseId: number
  executedAt: string
  status: string
  rows: number
  error?: string
}

export interface SearchResult {
  type: 'dashboard' | 'chart' | 'dataset'
  id: string | number
  name: string
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
}

export interface ExportJob {
  jobId: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  downloadUrl?: string | null
}

export interface DatabaseInfo {
  id: number
  databaseName: string
  backend: string
}
