import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  DashboardCreate,
  DashboardUpdate,
  ManagedDashboard,
} from '@/types/managed-dashboard'

export function useManagedDashboards() {
  return useQuery({
    queryKey: ['managed-dashboards'],
    queryFn: () => api.get<ManagedDashboard[]>('/api/dashboards/managed'),
  })
}

export function useManagedDashboard(id: string | null) {
  return useQuery({
    queryKey: ['managed-dashboard', id],
    queryFn: () => api.get<ManagedDashboard>(`/api/dashboards/managed/${id}`),
    enabled: id !== null,
  })
}

export function useCreateDashboard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DashboardCreate) =>
      api.post<ManagedDashboard>('/api/dashboards/managed', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
    },
  })
}

export function useUpdateDashboard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DashboardUpdate }) =>
      api.put<ManagedDashboard>(`/api/dashboards/managed/${id}`, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
      queryClient.invalidateQueries({ queryKey: ['managed-dashboard', id] })
    },
  })
}

export function useDeleteDashboard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/dashboards/managed/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
    },
  })
}
