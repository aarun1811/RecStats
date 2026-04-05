import { useEffect, useMemo, useRef } from 'react'

import { ConfigFilterBar } from '@/components/dashboard/config-filter-bar'
import { ConfigKpiRow } from '@/components/dashboard/config-kpi-row'
import { ConfigChartGrid } from '@/components/dashboard/config-chart-grid'
import { ConfigDataGrid } from '@/components/dashboard/config-data-grid'
import { CrossFilterBar } from '@/components/dashboard/cross-filter-bar'
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis'
import { useCrossFilterData } from '@/hooks/use-cross-filter-data'
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
  const applyFilters = useFilterStore((s) => s.applyFilters)
  const values = useFilterStore((s) => s.values)
  const appliedFilters = useFilterStore((s) => s.applied)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const clearCrossFilters = useFilterStore((s) => s.clearCrossFilters)
  const hasAutoApplied = useRef(false)

  useEffect(() => {
    const defaults: Record<string, FilterValue> = {}
    for (const filter of config.filters) {
      if (filter.defaultValue !== undefined) {
        defaults[filter.id] = filter.defaultValue
      }
    }
    const merged = { ...defaults, ...initialFilters }
    initializeFilters(merged, lockedFilters)
    hasAutoApplied.current = false
  }, [config.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply once when single-select filters auto-fill their first option
  useEffect(() => {
    if (hasAutoApplied.current) return
    const nonNullValues = Object.values(values).filter((v) => v != null)
    if (nonNullValues.length > 0) {
      applyFilters()
      hasAutoApplied.current = true
    }
  }, [values, applyFilters])

  // Clear cross-filters when global filters change (stale value prevention)
  const prevAppliedRef = useRef(appliedFilters)
  useEffect(() => {
    if (prevAppliedRef.current !== appliedFilters && crossFilters.length > 0) {
      clearCrossFilters()
    }
    prevAppliedRef.current = appliedFilters
  }, [appliedFilters, crossFilters.length, clearCrossFilters])

  const { data: kpisData } = useDashboardKpis(config.id, appliedFilters)
  const kpiResults = kpisData?.kpis

  // Cross-filter data layer: client-side KPI re-aggregation
  const { crossFilteredKpis, partialMatches } = useCrossFilterData(
    config,
    appliedFilters,
  )

  // Build column labels map from dashboard config for the cross-filter bar
  const columnLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    // Column labels will be inferred from data -- pass empty for now
    // The CrossFilterBar falls back to capitalizing column names
    return labels
  }, [config]) // eslint-disable-line react-hooks/exhaustive-deps

  const crossFilterEnabled = config.features.crossFilter

  return (
    <div className="flex flex-col gap-4">
      <ConfigFilterBar filters={config.filters} />
      {crossFilterEnabled && <CrossFilterBar columnLabels={columnLabels} />}
      <ConfigKpiRow
        dashboardId={config.id}
        kpis={config.kpis}
        crossFilteredKpis={crossFilteredKpis}
        partialMatches={partialMatches}
      />
      <ConfigChartGrid
        charts={config.charts}
        kpiResults={crossFilteredKpis ?? kpiResults}
        crossFilterEnabled={crossFilterEnabled}
      />
      <ConfigDataGrid
        grids={config.grids}
        kpiResults={crossFilteredKpis ?? kpiResults}
        crossFilterEnabled={crossFilterEnabled}
      />
    </div>
  )
}
