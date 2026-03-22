import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DatasetInfo } from '@/types/dataset'

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.get<DatasetInfo[]>('/api/datasets'),
  })
}
