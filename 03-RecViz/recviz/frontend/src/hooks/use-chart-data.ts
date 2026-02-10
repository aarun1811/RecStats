import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ChartDataResponse } from '@/types/chart'
import type { GlobalFilters } from '@/types/filter'
import { useFilterStore } from '@/stores/filter-store'

export function useChartData(chartId: string, enabled = true) {
  const globalFilters = useFilterStore((s) => s.globalFilters)

  return useQuery({
    queryKey: ['chart-data', chartId, globalFilters],
    queryFn: () =>
      api.post<ChartDataResponse>(`/api/charts/${chartId}/data`, {
        filters: globalFilters,
      }),
    enabled: enabled && !!chartId,
  })
}

export function useChartDataWithFilters(
  chartId: string,
  filters: GlobalFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: ['chart-data', chartId, filters],
    queryFn: () =>
      api.post<ChartDataResponse>(`/api/charts/${chartId}/data`, { filters }),
    enabled: enabled && !!chartId,
  })
}
