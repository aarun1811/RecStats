import type { KpiConfig, KpiResult, DataSourceQueryResponse } from '@/types/dashboard-config'
import type { CrossFilter } from '@/types/filter'
import { applyCrossFiltersToRows } from '@/lib/cross-filter'

/**
 * Describes a KPI that could not be fully filtered because one or more
 * cross-filter columns were missing from its data source(s).
 */
export interface KpiPartialMatch {
  kpiId: string
  missingColumns: string[]
}

export interface RecomputeKpisResult {
  kpis: KpiResult[]
  partialMatches: KpiPartialMatch[]
}

/**
 * Recompute KPI values client-side from cached data source rows,
 * applying cross-filters. Reports partial matches when a KPI's data
 * source lacks one or more cross-filter columns.
 */
export function recomputeKpis(
  kpiConfigs: KpiConfig[],
  dataCache: Map<string, DataSourceQueryResponse>,
  crossFilters: CrossFilter[],
): RecomputeKpisResult {
  const kpiValues = new Map<string, number>()
  const partialMatches: KpiPartialMatch[] = []

  for (const kpi of kpiConfigs) {
    let total = 0
    const missingColumns = new Set<string>()

    for (const source of kpi.sources) {
      const data = dataCache.get(source.dataSourceId)
      if (!data) continue

      // Check which cross-filter columns are missing from this data source
      for (const cf of crossFilters) {
        if (data.rows.length > 0 && !(cf.column in data.rows[0])) {
          missingColumns.add(cf.column)
        }
      }

      const filtered = applyCrossFiltersToRows(data.rows, crossFilters)
      for (const row of filtered) {
        const val = row[source.metric]
        if (val != null) total += Number(val)
      }
    }
    kpiValues.set(kpi.id, total)

    if (missingColumns.size > 0) {
      partialMatches.push({
        kpiId: kpi.id,
        missingColumns: Array.from(missingColumns),
      })
    }
  }

  const kpis = kpiConfigs.map((kpi) => {
    const result: KpiResult = {
      id: kpi.id,
      value: kpiValues.get(kpi.id) ?? 0,
    }
    if (kpi.trend?.type === 'percentage_of') {
      const refValue = kpiValues.get(kpi.trend.referenceKpi) ?? 0
      result.percentage = refValue > 0
        ? (result.value / refValue) * 100
        : 0
    }
    return result
  })

  return { kpis, partialMatches }
}
