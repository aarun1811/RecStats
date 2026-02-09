import type { SqlExecuteRequest, SqlExecuteResponse, QueryHistoryItem } from '@/types/api'
import { api } from '@/lib/api-client'

export function executeSql(
  request: SqlExecuteRequest,
): Promise<SqlExecuteResponse> {
  return api.post<SqlExecuteResponse>('/sql/execute', request)
}

export function fetchQueryHistory(): Promise<QueryHistoryItem[]> {
  return api.get<QueryHistoryItem[]>('/sql/history')
}
