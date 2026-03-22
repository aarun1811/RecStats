import { useEffect } from 'react'
import { useQueryClient, useIsFetching } from '@tanstack/react-query'

import { fetchChartData } from '@/lib/api/charts'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'
import { useFilterStore } from '@/stores/filter-store'

export function usePrefetchDeskData(chartId: string, desks: string[]) {
  const queryClient = useQueryClient()
  const globalFilters = useFilterStore((s) => s.globalFilters)
  const isFetching = useIsFetching()

  useEffect(() => {
    if (isFetching > 0) return
    if (desks.length === 0) return

    for (const desk of desks) {
      const filters = {
        ...globalFilters,
        desks: [desk],
      }

      void queryClient.prefetchQuery({
        queryKey: queryKeys.charts.data(chartId, filters),
        queryFn: () => fetchChartData(chartId, filters),
        staleTime: QUERY_STALE_TIME,
        gcTime: QUERY_GC_TIME,
      })
    }
  }, [chartId, desks, globalFilters, isFetching, queryClient])
}
