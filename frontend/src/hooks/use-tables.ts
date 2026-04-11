import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SchemaTable } from '@/types/schema'

export function useTables(dbId: string | null) {
  return useQuery({
    queryKey: ['tables', dbId],
    queryFn: () => api.get<SchemaTable[]>(`/api/databases/${dbId}/tables`),
    enabled: dbId !== null && dbId !== '',
    staleTime: 5 * 60 * 1000,
  })
}
