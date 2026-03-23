import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type { FilterValue } from '@/types/filter'
import type { DataSourceQueryResponse } from '@/types/dashboard-config'

interface MergeConfig {
  sources: string[]
  mergeOn: string[]
  mergeType: string
}

export function useDataSourceMerge(
  mergeConfig: MergeConfig,
  filters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['data-source-merge', mergeConfig.sources, filters],
    queryFn: () =>
      api.post<DataSourceQueryResponse>('/api/data-sources/merge', {
        sources: mergeConfig.sources,
        merge_on: mergeConfig.mergeOn,
        merge_type: mergeConfig.mergeType,
        filters,
      }),
    enabled: enabled && mergeConfig.sources.length > 0,
  })
}
