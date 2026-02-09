import { useQuery, keepPreviousData } from '@tanstack/react-query'

import { fetchChartData } from '@/lib/api/charts'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'
import { useFilterStore } from '@/stores/filter-store'

export function useChartData(chartId: string) {
  const globalFilters = useFilterStore((s) => s.globalFilters)

  return useQuery({
    queryKey: queryKeys.charts.data(chartId, globalFilters),
    queryFn: () => fetchChartData(chartId, globalFilters),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    placeholderData: keepPreviousData,
  })
}
