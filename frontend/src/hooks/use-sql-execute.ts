import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SqlResult } from '@/types/api'

interface SqlExecuteParams {
  sql: string
  databaseId?: number
  schema?: string
  limit?: number
}

export function useSqlExecute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SqlExecuteParams) =>
      api.post<SqlResult>('/api/sql/execute', {
        sql: params.sql,
        database_id: params.databaseId ?? 1,
        schema: params.schema ?? 'public',
        limit: params.limit ?? 1000,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sql-history'] })
    },
  })
}
