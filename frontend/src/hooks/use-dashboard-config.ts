import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { DashboardConfig } from '@/types/dashboard-config'

export function useDashboardConfig(dashboardId: string) {
  return useQuery({
    queryKey: ['dashboard-config', dashboardId],
    queryFn: () => api.get<DashboardConfig>(`/api/dashboards/${dashboardId}`),
    enabled: !!dashboardId,
    staleTime: 10 * 60 * 1000,
  })
}
