import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  DatabaseCreate,
  DatabaseInfo,
  DatabaseUpdate,
  DatasetPage,
  TestConnectionRequest,
  TestConnectionResponse,
} from '@/types/database'

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: () => api.get<DatabaseInfo[]>('/api/databases'),
  })
}

export function useDatabase(id: string | null) {
  return useQuery({
    queryKey: ['database', id],
    queryFn: () => api.get<DatabaseInfo>(`/api/databases/${id}`),
    enabled: id !== null,
  })
}

export function useDatabaseDatasets(dbId: string | null) {
  return useInfiniteQuery({
    queryKey: ['database-datasets', dbId],
    queryFn: ({ pageParam = 1 }) =>
      api.get<DatasetPage>(
        `/api/databases/${dbId}/datasets?page=${pageParam}&page_size=50`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize
      return loaded < lastPage.total ? lastPage.page + 1 : undefined
    },
    enabled: dbId !== null,
  })
}

export function useCreateDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DatabaseCreate) =>
      api.post<DatabaseInfo>('/api/databases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useUpdateDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DatabaseUpdate }) =>
      api.put<DatabaseInfo>(`/api/databases/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useDeleteDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/databases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (data: TestConnectionRequest) =>
      api.post<TestConnectionResponse>('/api/databases/test', data),
  })
}

export function useSyncDatasets() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dbId: string) =>
      api.post<{ success: boolean }>(
        `/api/databases/${dbId}/sync`,
      ),
    onSuccess: (_data, dbId) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      queryClient.invalidateQueries({ queryKey: ['database', dbId] })
      queryClient.invalidateQueries({ queryKey: ['database-datasets', dbId] })
    },
  })
}
