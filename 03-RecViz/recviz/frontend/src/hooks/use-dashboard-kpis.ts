import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { KpisResponse } from '@/types/dashboard-config'

export function useDashboardKpis(
  dashboardId: string,
  filters: Record<string, FilterValue>,
) {
  return useQuery({
    queryKey: ['dashboard-kpis', dashboardId, filters],
    queryFn: () =>
      api.post<KpisResponse>(`/api/dashboards/${dashboardId}/kpis`, {
        filters,
      }),
    enabled: !!dashboardId && Object.keys(filters).length > 0,
  })
}
