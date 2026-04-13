import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ConfigFilterBar } from '@/components/dashboard/config-filter-bar'
import { ConfigKpiRow } from '@/components/dashboard/config-kpi-row'
import { ConfigChartGrid } from '@/components/dashboard/config-chart-grid'
import { ConfigDataGrid } from '@/components/dashboard/config-data-grid'
import { CrossFilterBar } from '@/components/dashboard/cross-filter-bar'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis'
import { useCrossFilterData } from '@/hooks/use-cross-filter-data'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { useFilterStore } from '@/stores/filter-store'
import { useDrillStore } from '@/stores/drill-store'
import type { DashboardConfig } from '@/types/dashboard-config'
import type { FilterValue } from '@/types/filter'

interface DashboardRendererProps {
  config: DashboardConfig
  initialFilters?: Record<string, FilterValue>
  lockedFilters?: string[]
  /**
   * When true, omit the `ConfigFilterBar` from the rendered dashboard.
   * Used by embed mode with `?hide=filter-bar`. Non-embed usages leave this
   * undefined and the filter bar renders normally.
   */
  hideFilterBar?: boolean
  /**
   * When true, omit the `DashboardToolbar` (refresh + auto-refresh controls)
   * AND disable the auto-refresh interval by passing 0 to `useAutoRefresh`.
   * Without the UI control there is no way for the user to see or adjust
   * the interval; the host portal is responsible for any external refresh
   * orchestration in this mode. Used by embed mode with `?hide=toolbar`.
   */
  hideToolbar?: boolean
}

export function DashboardRenderer({
  config,
  initialFilters,
  lockedFilters,
  hideFilterBar,
  hideToolbar,
}: DashboardRendererProps) {
  const initializeFilters = useFilterStore((s) => s.initializeFilters)
  const applyFilters = useFilterStore((s) => s.applyFilters)
  const values = useFilterStore((s) => s.values)
  const appliedFilters = useFilterStore((s) => s.applied)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const clearCrossFilters = useFilterStore((s) => s.clearCrossFilters)
  const resetAllDrills = useDrillStore((s) => s.resetAllDrills)
  const hasAutoApplied = useRef(false)
  const queryClient = useQueryClient()

  // Auto-refresh interval state (persisted in config)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(
    config.autoRefreshInterval ?? 600_000,
  )

  // Manual refresh handler.
  // TanStack Query deduplicates: shared query keys = single network request.
  // No staggering needed -- TQ scheduling + HTTP/2 multiplexing handle concurrency.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ['data-source'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      toast.success('Dashboard refreshed')
    } catch (err) {
      toast.error(
        `Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}. Showing cached data.`,
      )
    } finally {
      setIsRefreshing(false)
      reset()
    }
  }, [queryClient]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh hook wired to the same refresh handler.
  // When the toolbar is hidden (embed mode `?hide=toolbar`), pass 0 so the
  // hook returns `isActive: false` and does not start the countdown interval.
  // `useAutoRefresh` treats `intervalMs <= 0` as disabled.
  const autoRefreshIntervalEffective = hideToolbar ? 0 : autoRefreshInterval
  const { remainingMs, isActive, reset } = useAutoRefresh(
    autoRefreshIntervalEffective,
    handleRefresh,
  )

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
    resetAllDrills()
    setAutoRefreshInterval(config.autoRefreshInterval ?? 600_000)
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

  // Clear cross-filters and drill state when global filters change (stale value prevention)
  const prevAppliedRef = useRef(appliedFilters)
  useEffect(() => {
    if (prevAppliedRef.current !== appliedFilters) {
      if (crossFilters.length > 0) {
        clearCrossFilters()
      }
      resetAllDrills()
    }
    prevAppliedRef.current = appliedFilters
  }, [appliedFilters, crossFilters.length, clearCrossFilters, resetAllDrills])

  const { data: kpisData } = useDashboardKpis(config.kpis, appliedFilters)
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
  const drillDownEnabled = config.features.drillDown

  return (
    <div className="flex flex-col gap-4">
      {!hideToolbar && (
        <DashboardToolbar
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          autoRefreshIntervalMs={autoRefreshInterval}
          onAutoRefreshIntervalChange={setAutoRefreshInterval}
          autoRefreshRemainingMs={remainingMs}
          autoRefreshIsActive={isActive}
        />
      )}
      {!hideFilterBar && <ConfigFilterBar filters={config.filters} />}
      {crossFilterEnabled && <CrossFilterBar columnLabels={columnLabels} />}
      <ConfigKpiRow
        kpis={config.kpis}
        crossFilteredKpis={crossFilteredKpis}
        partialMatches={partialMatches}
      />
      <ConfigChartGrid
        charts={config.charts}
        kpiResults={crossFilteredKpis ?? kpiResults}
        crossFilterEnabled={crossFilterEnabled}
        drillDownEnabled={drillDownEnabled}
        dashboardHasFilters={config.filters.length > 0}
        onRefreshKpis={handleRefresh}
        isRefreshingKpis={isRefreshing}
      />
      <ConfigDataGrid
        grids={config.grids}
        kpiResults={crossFilteredKpis ?? kpiResults}
        crossFilterEnabled={crossFilterEnabled}
      />
    </div>
  )
}
