import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'

import { fetchDatasetData } from '@/lib/api/datasets'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME, QUERY_GC_TIME, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { useFilterStore } from '@/stores/filter-store'
import { toSupersetFilters } from '@/lib/filter-utils'

export function useGridData(datasetId: number) {
  const globalFilters = useFilterStore((s) => s.globalFilters)

  return useInfiniteQuery({
    queryKey: queryKeys.datasets.data(datasetId, globalFilters),
    queryFn: ({ pageParam = 0 }) =>
      fetchDatasetData(datasetId, {
        filters: toSupersetFilters(globalFilters),
        orderBy: [],
        offset: pageParam,
        limit: DEFAULT_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    placeholderData: keepPreviousData,
  })
}
