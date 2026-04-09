import { useMemo } from 'react'
import { keepPreviousData, useQueries } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type {
  DataSourceQueryResponse,
  KpiConfig,
  KpiResult,
  KpisResponse,
} from '@/types/dashboard-config'

/**
 * Compute dashboard KPI values client-side.
 *
 * Previously this hit the legacy `POST /api/dashboards/:id/kpis` endpoint which
 * validated the dashboard JSONB through a snake_case Pydantic model. After the
 * managed dashboard builder (Phase 8) started writing camelCase JSONB, that
 * endpoint started 500-ing, and during Phase 10 legacy cleanup the endpoint +
 * its Pydantic model were deleted entirely.
 *
 * New behavior: for each KPI's `sources[]`, fetch the referenced data source
 * via `POST /api/data-sources/:id/query` (same hot path charts use, already
 * cached by TanStack Query), then compute the aggregation from the returned
 * rows. Zero new backend endpoints. Fully client-side once the datasets are
 * fetched.
 */
export function useDashboardKpis(
  kpis: KpiConfig[],
  filters: Record<string, FilterValue>,
): {
  data: KpisResponse | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
} {
  // Collect unique data source IDs across all KPIs' sources
  const dataSourceIds = useMemo(() => {
    const ids = new Set<string>()
    for (const kpi of kpis) {
      for (const source of kpi.sources) {
        ids.add(source.dataSourceId)
      }
    }
    return Array.from(ids)
  }, [kpis])

  // Fetch each unique data source once
  const queries = useQueries({
    queries: dataSourceIds.map((id) => ({
      queryKey: ['data-source', id, filters] as const,
      queryFn: () =>
        api.post<DataSourceQueryResponse>(
          `/api/data-sources/${id}/query`,
          { filters },
        ),
      enabled: !!id && Object.keys(filters).length > 0,
      placeholderData: keepPreviousData,
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const firstError = queries.find((q) => q.isError)
  const isError = !!firstError
  const error = (firstError?.error as Error | undefined) ?? null

  const data = useMemo<KpisResponse | undefined>(() => {
    if (isLoading || isError) return undefined

    // Build dataset cache: dataSourceId -> rows
    const cache = new Map<string, DataSourceQueryResponse>()
    for (let i = 0; i < dataSourceIds.length; i++) {
      const d = queries[i]?.data
      if (d) cache.set(dataSourceIds[i], d)
    }
    if (cache.size === 0) return undefined

    // Compute each KPI value from its sources using the configured aggregation
    const results: KpiResult[] = kpis.map((kpi) => {
      let total = 0
      let count = 0
      for (const source of kpi.sources) {
        const dataset = cache.get(source.dataSourceId)
        if (!dataset) continue
        for (const row of dataset.rows) {
          const val = row[source.metric]
          if (val != null) {
            const n = typeof val === 'number' ? val : Number(val)
            if (!Number.isNaN(n)) {
              total += n
              count += 1
            }
          }
        }
      }
      const agg = kpi.aggregation ?? 'SUM'
      let value: number
      if (agg === 'AVG' && count > 0) {
        value = total / count
      } else if (agg === 'COUNT') {
        value = count
      } else if (agg === 'MIN') {
        // Re-scan for MIN (total was a sum)
        let min = Infinity
        for (const source of kpi.sources) {
          const dataset = cache.get(source.dataSourceId)
          if (!dataset) continue
          for (const row of dataset.rows) {
            const val = row[source.metric]
            if (val != null) {
              const n = typeof val === 'number' ? val : Number(val)
              if (!Number.isNaN(n) && n < min) min = n
            }
          }
        }
        value = min === Infinity ? 0 : min
      } else if (agg === 'MAX') {
        let max = -Infinity
        for (const source of kpi.sources) {
          const dataset = cache.get(source.dataSourceId)
          if (!dataset) continue
          for (const row of dataset.rows) {
            const val = row[source.metric]
            if (val != null) {
              const n = typeof val === 'number' ? val : Number(val)
              if (!Number.isNaN(n) && n > max) max = n
            }
          }
        }
        value = max === -Infinity ? 0 : max
      } else {
        // SUM (default)
        value = total
      }
      return { id: kpi.id, value }
    })

    // Compute percentage_of trends (KPI A as % of KPI B)
    const valuesById = new Map(results.map((r) => [r.id, r.value]))
    for (const result of results) {
      const kpi = kpis.find((k) => k.id === result.id)
      if (kpi?.trend?.type === 'percentage_of') {
        const refValue = valuesById.get(kpi.trend.referenceKpi) ?? 0
        if (refValue > 0) {
          result.percentage = Math.round((result.value / refValue) * 10000) / 100
        } else {
          result.percentage = 0
        }
      }
    }

    return { kpis: results }
  }, [kpis, queries, dataSourceIds, isLoading, isError])

  const refetch = () => {
    queries.forEach((q) => q.refetch())
  }

  return { data, isLoading, isError, error, refetch }
}
