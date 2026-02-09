import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { searchGlobal } from '@/lib/api/search'
import { queryKeys } from '@/lib/query-keys'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'

export function useSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [query])

  return useQuery({
    queryKey: queryKeys.search.results(debouncedQuery),
    queryFn: () => searchGlobal(debouncedQuery),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: debouncedQuery.length >= 2,
  })
}
