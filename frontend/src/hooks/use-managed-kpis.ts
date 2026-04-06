import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import type {
  KpiCreate,
  KpiDeleteCheck,
  KpiUpdate,
  RecvizKpi,
} from '@/types/managed-kpi'

export function useManagedKpis() {
  return useQuery({
    queryKey: ['managed-kpis'],
    queryFn: () => api.get<RecvizKpi[]>('/api/kpis/managed'),
  })
}

export function useManagedKpi(id: string | null) {
  return useQuery({
    queryKey: ['managed-kpi', id],
    queryFn: () => api.get<RecvizKpi>(`/api/kpis/managed/${id}`),
    enabled: id !== null,
  })
}

export function useCreateKpi() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: KpiCreate) =>
      api.post<RecvizKpi>('/api/kpis/managed', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-kpis'] })
    },
  })
}

export function useUpdateKpi() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: KpiUpdate }) =>
      api.put<RecvizKpi>(`/api/kpis/managed/${id}`, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['managed-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['managed-kpi', id] })
    },
  })
}

export function useDeleteKpi() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/kpis/managed/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-kpis'] })
    },
  })
}

export function useKpiReferences(id: string | null) {
  return useQuery({
    queryKey: ['kpi-references', id],
    queryFn: () =>
      api.get<KpiDeleteCheck>(`/api/kpis/managed/${id}/references`),
    enabled: id !== null,
  })
}
