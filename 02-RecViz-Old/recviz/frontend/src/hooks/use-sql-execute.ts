import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { executeSql, fetchQueryHistory } from '@/lib/api/sql'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'

export function useSqlExecute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: executeSql,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sql.history() })
    },
  })
}

export function useQueryHistory() {
  return useQuery({
    queryKey: queryKeys.sql.history(),
    queryFn: fetchQueryHistory,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
  })
}
