import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DashboardListItem } from '@/types/dashboard'

export function useDashboards() {
  return useQuery({
    queryKey: ['dashboards'],
    queryFn: () => api.get<DashboardListItem[]>('/api/dashboards'),
  })
}
