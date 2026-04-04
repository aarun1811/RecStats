import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SavedView, SavedViewCreate } from '@/types/views'

export function useSavedViews() {
  return useQuery({
    queryKey: ['saved-views'],
    queryFn: () => api.get<SavedView[]>('/api/views'),
  })
}

export function useCreateView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (view: SavedViewCreate) =>
      api.post<SavedView>('/api/views', view),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views'] })
    },
  })
}

export function useDeleteView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (viewId: string) => api.delete(`/api/views/${viewId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views'] })
    },
  })
}
