import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  ChartCreate,
  ChartDeleteCheck,
  ChartUpdate,
  RecvizChart,
} from '@/types/managed-chart'

export function useManagedCharts() {
  return useQuery({
    queryKey: ['managed-charts'],
    queryFn: () => api.get<RecvizChart[]>('/api/charts/managed'),
  })
}

export function useManagedChart(id: string | null) {
  return useQuery({
    queryKey: ['managed-chart', id],
    queryFn: () => api.get<RecvizChart>(`/api/charts/managed/${id}`),
    enabled: id !== null,
  })
}

export function useCreateChart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ChartCreate) =>
      api.post<RecvizChart>('/api/charts/managed', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-charts'] })
    },
  })
}

export function useUpdateChart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChartUpdate }) =>
      api.put<RecvizChart>(`/api/charts/managed/${id}`, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['managed-charts'] })
      queryClient.invalidateQueries({ queryKey: ['managed-chart', id] })
    },
  })
}

export function useDeleteChart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/charts/managed/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['managed-charts'], refetchType: 'all' })
    },
  })
}

export function useChartReferences(id: string | null) {
  return useQuery({
    queryKey: ['chart-references', id],
    queryFn: () =>
      api.get<ChartDeleteCheck>(`/api/charts/managed/${id}/references`),
    enabled: id !== null,
  })
}
