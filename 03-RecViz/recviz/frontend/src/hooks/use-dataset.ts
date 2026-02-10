import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DatasetInfo } from '@/types/dataset'

export function useDataset(id: number) {
  return useQuery({
    queryKey: ['dataset', id],
    queryFn: () => api.get<DatasetInfo>(`/api/datasets/${id}`),
    enabled: !!id,
  })
}
