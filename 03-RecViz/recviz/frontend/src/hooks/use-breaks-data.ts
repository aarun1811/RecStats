import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useFilterStore } from '@/stores/filter-store'

interface BreaksDataResponse {
  data: Record<string, unknown>[]
  rowCount: number
  page: number
  pageSize: number
}

export function useBreaksData(pageSize = 1000) {
  const globalFilters = useFilterStore((s) => s.globalFilters)

  return useQuery({
    queryKey: ['breaks-data', globalFilters, pageSize],
    queryFn: () =>
      api.post<BreaksDataResponse>(
        `/api/datasets/5/data?page=1&page_size=${pageSize}`,
        globalFilters,
      ),
  })
}
