import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { DataSourceQueryResponse } from '@/types/dashboard-config'
import type { DrillLevel, FilterValue } from '@/types/filter'

/**
 * Fetches raw detail rows for the deepest drill level.
 * Appends drill-level filters to the applied global filters.
 *
 * Reuses the existing `/api/data-sources/{id}/query` endpoint.
 * Drill levels become additional filter key-value pairs
 * (e.g., { break_type: "Unmatched", aging_bucket: "30-60" })
 * appended to the global filters. The backend's QueryEngine._build_sql
 * handles these as WHERE clauses via its filter mapping system.
 */
export function useDrillDetail(
  dataSourceId: string | undefined,
  appliedFilters: Record<string, FilterValue>,
  drillLevels: DrillLevel[],
  enabled: boolean = true,
) {
  // Merge global filters with drill-level filters
  const mergedFilters = {
    ...appliedFilters,
    ...Object.fromEntries(
      drillLevels.map((level) => [level.column, level.value]),
    ),
  }

  return useQuery({
    queryKey: ['drill-detail', dataSourceId, mergedFilters],
    queryFn: () =>
      api.post<DataSourceQueryResponse>(
        `/api/data-sources/${dataSourceId}/query`,
        { filters: mergedFilters },
      ),
    enabled: enabled && !!dataSourceId && drillLevels.length > 0,
    placeholderData: keepPreviousData,
  })
}
