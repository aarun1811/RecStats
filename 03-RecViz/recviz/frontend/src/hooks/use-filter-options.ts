import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DistinctValuesResponse } from '@/types/dashboard-config'

export function useFilterOptions(
  dataSourceId: string,
  column: string,
  dependsOn: Record<string, string>,
  allFilterValues: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  // Extract only the parent filter values that this filter depends on
  const parentValues: Record<string, FilterValue> = {}
  for (const filterId of Object.keys(dependsOn)) {
    if (allFilterValues[filterId] !== undefined) {
      parentValues[filterId] = allFilterValues[filterId]
    }
  }

  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(parentValues)) {
    if (val !== undefined && val !== null) {
      params.set(`filter.${key}`, String(val))
    }
  }

  return useQuery({
    queryKey: ['filter-options', dataSourceId, column, parentValues],
    queryFn: () =>
      api.get<DistinctValuesResponse>(
        `/api/data-sources/${dataSourceId}/distinct/${column}?${params.toString()}`,
      ),
    enabled: enabled && !!dataSourceId && !!column,
  })
}
