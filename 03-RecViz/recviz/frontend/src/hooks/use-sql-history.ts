import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SqlHistoryItem } from '@/types/api'

export function useSqlHistory() {
  return useQuery({
    queryKey: ['sql-history'],
    queryFn: () => api.get<SqlHistoryItem[]>('/api/sql/history'),
  })
}
