import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DashboardConfig } from '@/types/dashboard'

export function useDashboard(id: string) {
  return useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => api.get<DashboardConfig>(`/api/dashboards/${id}`),
    enabled: !!id,
  })
}
