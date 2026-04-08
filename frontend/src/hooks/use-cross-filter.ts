import { useMemo } from 'react'

import type { ChartDataResponse } from '@/types/chart'
import { useFilterStore } from '@/stores/filter-store'
import { applyCrossFilters } from '@/lib/cross-filter'

/**
 * Applies cross-filters to chart data using column-name matching.
 * Filters from the same source chart are excluded (no self-filtering).
 * Charts without the filtered column are unaffected.
 */
export function useCrossFilter(
  chartId: string,
  data: ChartDataResponse | undefined,
) {
  const crossFilters = useFilterStore((s) => s.crossFilters)

  return useMemo(
    () => applyCrossFilters(data, crossFilters, chartId),
    [chartId, data, crossFilters],
  )
}
