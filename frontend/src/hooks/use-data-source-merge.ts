import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DataSourceQueryResponse } from '@/types/dashboard-config'

export interface MergeConfig {
  sources: string[]
  mergeOn: string[]
  mergeType: string
  coalesceZero?: boolean
}

export function useDataSourceMerge(
  mergeConfig: MergeConfig,
  filters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: [
      'data-source-merge',
      mergeConfig.sources,
      mergeConfig.mergeOn,
      mergeConfig.mergeType,
      mergeConfig.coalesceZero ?? false,
      filters,
    ],
    queryFn: () =>
      api.post<DataSourceQueryResponse>('/api/data-sources/merge', {
        sources: mergeConfig.sources,
        merge_on: mergeConfig.mergeOn,
        merge_type: mergeConfig.mergeType,
        coalesce_zero: mergeConfig.coalesceZero ?? false,
        filters,
      }),
    enabled: enabled && mergeConfig.sources.length > 0,
    placeholderData: keepPreviousData,
  })
}
