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

  // Multi-select cascade dependency: when a parent filter holds 2+ values, emit
  // each as its own `filter.<key>=<value>` query param so the backend can
  // re-assemble a list. A comma-joined string would be misread as a single
  // SQL literal (e.g. `agent_code IN ('A,B')`) and match nothing.
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(parentValues)) {
    if (val !== undefined && val !== null) {
      if (Array.isArray(val)) {
        // Empty array = filter not active; skip emitting the key.
        for (const item of val) {
          params.append(`filter.${key}`, String(item))
        }
      } else {
        params.set(`filter.${key}`, String(val))
      }
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
