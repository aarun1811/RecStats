import { useQuery } from '@tanstack/react-query'

import { fetchDashboards, fetchDashboard } from '@/lib/api/dashboards'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'

export function useDashboards() {
  return useQuery({
    queryKey: queryKeys.dashboards.list(),
    queryFn: fetchDashboards,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
  })
}

export function useDashboard(id: string) {
  return useQuery({
    queryKey: queryKeys.dashboards.detail(id),
    queryFn: () => fetchDashboard(id),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: id.length > 0,
  })
}
