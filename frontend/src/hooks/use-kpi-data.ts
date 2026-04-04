// TODO: Phase 2 — port KPI data fetching logic to config-driven system
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { KpiData } from '@/types/api'
import { useFilterStore } from '@/stores/filter-store'

export function useKpiData() {
  const globalFilters = useFilterStore((s) => s.globalFilters)

  return useQuery({
    queryKey: ['kpi', globalFilters],
    queryFn: () => api.post<KpiData>('/api/custom/kpi', globalFilters),
  })
}
