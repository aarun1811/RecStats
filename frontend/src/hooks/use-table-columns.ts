import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SchemaColumn } from '@/types/schema'

export function useTableColumns(dbId: string | null, tableName: string | null) {
  return useQuery({
    queryKey: ['columns', dbId, tableName],
    queryFn: () =>
      api.get<SchemaColumn[]>(
        `/api/databases/${dbId}/tables/${tableName}/columns`,
      ),
    enabled: dbId !== null && dbId !== '' && tableName !== null && tableName !== '',
    staleTime: 5 * 60 * 1000,
  })
}
