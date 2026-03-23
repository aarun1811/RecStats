import { useEffect } from 'react'

import { ConfigFilterBar } from '@/components/dashboard/config-filter-bar'
import { ConfigKpiRow } from '@/components/dashboard/config-kpi-row'
import { ConfigChartGrid } from '@/components/dashboard/config-chart-grid'
import { ConfigDataGrid } from '@/components/dashboard/config-data-grid'
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis'
import { useFilterStore } from '@/stores/filter-store'
import type { DashboardConfig } from '@/types/dashboard-config'
import type { FilterValue } from '@/types/filter'

interface DashboardRendererProps {
  config: DashboardConfig
  initialFilters?: Record<string, FilterValue>
  lockedFilters?: string[]
}

export function DashboardRenderer({
  config,
  initialFilters,
  lockedFilters,
}: DashboardRendererProps) {
  const initializeFilters = useFilterStore((s) => s.initializeFilters)
  const appliedFilters = useFilterStore((s) => s.applied)

  useEffect(() => {
    const defaults: Record<string, FilterValue> = {}
    for (const filter of config.filters) {
      if (filter.defaultValue !== undefined) {
        defaults[filter.id] = filter.defaultValue
      }
    }
    const merged = { ...defaults, ...initialFilters }
    initializeFilters(merged, lockedFilters)
  }, [config.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: kpisData } = useDashboardKpis(config.id, appliedFilters)
  const kpiResults = kpisData?.kpis

  return (
    <div className="flex flex-col gap-4">
      <ConfigFilterBar filters={config.filters} />
      <ConfigKpiRow dashboardId={config.id} kpis={config.kpis} />
      <ConfigChartGrid charts={config.charts} kpiResults={kpiResults} />
      <ConfigDataGrid grids={config.grids} kpiResults={kpiResults} />
    </div>
  )
}
