import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ChartDataResponse } from '@/types/chart'
import type { GlobalFilters } from '@/types/filter'
import { useFilterStore } from '@/stores/filter-store'

/**
 * The API client transforms all object keys to camelCase, but the `columns`
 * array contains raw string values that don't get transformed. Sync them
 * so buildSeries can match columns[i] to actual data-row keys.
 */
function syncColumns(res: ChartDataResponse): ChartDataResponse {
  if (!res.data?.length) return res
  const actualKeys = Object.keys(res.data[0])
  return { ...res, columns: actualKeys }
}

export function useChartData(chartId: string, enabled = true) {
  const globalFilters = useFilterStore((s) => s.globalFilters)

  return useQuery({
    queryKey: ['chart-data', chartId, globalFilters],
    queryFn: () =>
      api.post<ChartDataResponse>(`/api/charts/${chartId}/data`, {
        filters: globalFilters,
      }),
    select: syncColumns,
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
    select: syncColumns,
    enabled: enabled && !!chartId,
  })
}
