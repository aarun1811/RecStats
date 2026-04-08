import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  DatasetCreate,
  DatasetDeleteCheck,
  DatasetUpdate,
  RecvizDataset,
} from '@/types/managed-dataset'

export function useManagedDatasets() {
  return useQuery({
    queryKey: ['managed-datasets'],
    queryFn: () => api.get<RecvizDataset[]>('/api/datasets/managed'),
  })
}

export function useManagedDataset(id: string | null) {
  return useQuery({
    queryKey: ['managed-dataset', id],
    queryFn: () => api.get<RecvizDataset>(`/api/datasets/managed/${id}`),
    enabled: id !== null,
  })
}

export function useCreateDataset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DatasetCreate) =>
      api.post<RecvizDataset>('/api/datasets/managed', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-datasets'] })
    },
  })
}

export function useUpdateDataset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DatasetUpdate }) =>
      api.put<RecvizDataset>(`/api/datasets/managed/${id}`, data),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['managed-datasets'] })
      queryClient.invalidateQueries({ queryKey: ['managed-dataset', id] })
    },
  })
}

export function useDeleteDataset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/datasets/managed/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-datasets'] })
    },
  })
}

export function useDatasetReferences(id: string | null) {
  return useQuery({
    queryKey: ['dataset-references', id],
    queryFn: () =>
      api.get<DatasetDeleteCheck>(`/api/datasets/managed/${id}/references`),
    enabled: id !== null,
  })
}
