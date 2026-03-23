import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DataSourceQueryResponse } from '@/types/dashboard-config'

export function useDataSourceQuery(
  dataSourceId: string,
  filters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['data-source', dataSourceId, filters],
    queryFn: () =>
      api.post<DataSourceQueryResponse>(
        `/api/data-sources/${dataSourceId}/query`,
        { filters },
      ),
    enabled: enabled && !!dataSourceId,
    placeholderData: keepPreviousData,
  })
}
