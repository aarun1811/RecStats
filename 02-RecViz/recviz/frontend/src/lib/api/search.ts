import type { SearchResult } from '@/types/api'
import { api } from '@/lib/api-client'

export function searchGlobal(query: string): Promise<SearchResult[]> {
  return api.get<SearchResult[]>(
    `/search?q=${encodeURIComponent(query)}`,
  )
}
