import type { CrossFilter } from '@/types/filter'
import type { ChartDataResponse } from '@/types/chart'

/**
 * Apply cross-filters to chart data client-side.
 * For each cross-filter, if the chart data has a matching column,
 * filter rows to only those matching the cross-filter value.
 * Excludes filters from the same source chart (don't self-filter).
 */
export function applyCrossFilters(
  data: ChartDataResponse | undefined,
  crossFilters: CrossFilter[],
  selfChartId: string,
): ChartDataResponse | undefined {
  if (!data?.data?.length || crossFilters.length === 0) return data

  // Only apply filters from OTHER charts
  const externalFilters = crossFilters.filter((f) => f.sourceChartId !== selfChartId)
  if (externalFilters.length === 0) return data

  let filtered = data.data
  for (const filter of externalFilters) {
    // Check if the data has this column
    if (filter.column in filtered[0]) {
      filtered = filtered.filter((row) => row[filter.column] === filter.value)
    }
  }

  return {
    ...data,
    data: filtered,
    rowCount: filtered.length,
  }
}

/**
 * Check whether a raw data row passes all cross-filters.
 * Used for AG Grid external filtering.
 */
export function rowPassesCrossFilters(
  row: Record<string, unknown>,
  crossFilters: CrossFilter[],
): boolean {
  for (const filter of crossFilters) {
    const col = filter.column
    if (col in row && row[col] !== filter.value) {
      return false
    }
  }
  return true
}
