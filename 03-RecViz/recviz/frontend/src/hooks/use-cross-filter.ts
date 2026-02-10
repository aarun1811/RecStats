import { useMemo } from 'react'
import type { CrossFilterRule } from '@/types/filter'
import type { ChartDataResponse } from '@/types/chart'
import { useFilterStore } from '@/stores/filter-store'

/**
 * Applies cross-filters to chart data client-side.
 * Returns filtered data based on active cross-filter selections.
 */
export function useCrossFilter(
  chartId: string,
  data: ChartDataResponse | undefined,
  rules: CrossFilterRule[],
) {
  const crossFilters = useFilterStore((s) => s.crossFilters)

  return useMemo(() => {
    if (!data?.data?.length) return data

    // Find cross-filters that target this chart
    const applicableFilters = crossFilters.filter((cf) => {
      const rule = rules.find((r) => r.sourceChart === cf.sourceChartId)
      return rule?.targetCharts.includes(chartId)
    })

    if (!applicableFilters.length) return data

    // Filter data rows client-side
    const filtered = data.data.filter((row) =>
      applicableFilters.every((cf) => {
        const val = row[cf.column]
        return val === cf.value || val === String(cf.value)
      }),
    )

    return {
      ...data,
      data: filtered,
      rowCount: filtered.length,
    }
  }, [chartId, data, crossFilters, rules])
}
