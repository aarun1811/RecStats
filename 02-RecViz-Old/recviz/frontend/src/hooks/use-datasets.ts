import { useQuery } from '@tanstack/react-query'

import { fetchDatasets, fetchDatasetSchema } from '@/lib/api/datasets'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'

export function useDatasets() {
  return useQuery({
    queryKey: queryKeys.datasets.list(),
    queryFn: fetchDatasets,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
  })
}

export function useDatasetSchema(datasetId: number) {
  return useQuery({
    queryKey: queryKeys.datasets.schema(datasetId),
    queryFn: () => fetchDatasetSchema(datasetId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: datasetId > 0,
  })
}
