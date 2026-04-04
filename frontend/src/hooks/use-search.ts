import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SearchResponse } from '@/types/api'

export function useSearch() {
  return useMutation({
    mutationFn: (query: string) =>
      api.post<SearchResponse>('/api/search', { query }),
  })
}
