import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ChartDataResponse } from '@/types/chart'
import type { KpiData } from '@/types/api'

const CHART_IDS = [
  'break-trend',
  'breaks-by-category',
  'breaks-by-desk',
  'aging-distribution',
  'breaks-by-region',
  'match-rate-trend',
]

/**
 * Prefetches dashboard data in the background on mount.
 * Warms up the TanStack Query cache so charts render instantly.
 */
export function usePrefetch() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Prefetch KPIs
    queryClient.prefetchQuery({
      queryKey: ['kpi', {}],
      queryFn: () => api.post<KpiData>('/api/custom/kpi', {}),
    })

    // Prefetch chart data for main dashboard
    for (const chartId of CHART_IDS) {
      queryClient.prefetchQuery({
        queryKey: ['chart-data', chartId, {}],
        queryFn: () =>
          api.post<ChartDataResponse>(`/api/charts/${chartId}/data`, {
            filters: {},
          }),
      })
    }
  }, [queryClient])
}
