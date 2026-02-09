import type { ChartConfig } from '@/types/chart'
import type { ChartDataResponse } from '@/types/chart'
import type { GlobalFilters } from '@/types/filter'
import { api } from '@/lib/api-client'
import { toSupersetFilters } from '@/lib/filter-utils'

export function fetchChartData(
  chartId: string,
  filters: GlobalFilters,
): Promise<ChartDataResponse> {
  return api.post<ChartDataResponse>(`/charts/${chartId}/data`, {
    filters: toSupersetFilters(filters),
  })
}

export function fetchChartList(): Promise<ChartConfig[]> {
  return api.get<ChartConfig[]>('/charts')
}
