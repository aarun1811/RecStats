import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import { useFilterStore } from '@/stores/filter-store'
import { recomputeKpis } from '@/lib/kpi-aggregator'
import type { KpiPartialMatch } from '@/lib/kpi-aggregator'
import type { DashboardConfig, DataSourceQueryResponse, KpiResult } from '@/types/dashboard-config'
import type { FilterValue } from '@/types/filter'

/**
 * Cross-Filter Data Layer hook.
 *
 * Collects all unique data source IDs from KPIs in the dashboard config,
 * fetches each via TanStack Query (deduplicated, cached), and when cross-filters
 * are active, applies them to cached rows and recomputes KPI values client-side.
 *
 * Returns null KPIs when no cross-filters are active (use server-computed KPIs).
 * Returns partialMatches for KPIs whose data sources lack cross-filter columns.
 */
export function useCrossFilterData(
  config: DashboardConfig,
  appliedFilters: Record<string, FilterValue>,
): {
  crossFilteredKpis: KpiResult[] | null
  partialMatches: KpiPartialMatch[]
  isLoading: boolean
} {
  const crossFilters = useFilterStore((s) => s.crossFilters)

  // Collect all unique data source IDs used by KPIs
  const kpiDataSourceIds = useMemo(() => {
    const ids = new Set<string>()
    for (const kpi of config.kpis) {
      for (const source of kpi.sources) {
        ids.add(source.dataSourceId)
      }
    }
    return Array.from(ids)
  }, [config.kpis])

  // Fetch each KPI data source (TanStack Query handles caching/dedup)
  // Only fires when cross-filters are active -- no extra network calls otherwise.
  // Query key matches useDataSourceQuery format for shared cache entries.
  const queries = useQueries({
    queries: kpiDataSourceIds.map((id) => ({
      queryKey: ['data-source', id, appliedFilters] as const,
      queryFn: () =>
        api.post<DataSourceQueryResponse>(
          `/api/data-sources/${id}/query`,
          { filters: appliedFilters },
        ),
      enabled: crossFilters.length > 0 && !!id,
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)

  // Build data cache map from query results and recompute KPIs
  const result = useMemo((): {
    crossFilteredKpis: KpiResult[] | null
    partialMatches: KpiPartialMatch[]
  } => {
    if (crossFilters.length === 0) {
      return { crossFilteredKpis: null, partialMatches: [] }
    }

    const dataCache = new Map<string, DataSourceQueryResponse>()
    for (let i = 0; i < kpiDataSourceIds.length; i++) {
      const data = queries[i]?.data
      if (data) {
        dataCache.set(kpiDataSourceIds[i], data)
      }
    }

    if (dataCache.size === 0) {
      return { crossFilteredKpis: null, partialMatches: [] }
    }

    const { kpis, partialMatches } = recomputeKpis(config.kpis, dataCache, crossFilters)
    return { crossFilteredKpis: kpis, partialMatches }
  }, [crossFilters, queries, config.kpis, kpiDataSourceIds])

  return {
    crossFilteredKpis: result.crossFilteredKpis,
    partialMatches: result.partialMatches,
    isLoading,
  }
}
