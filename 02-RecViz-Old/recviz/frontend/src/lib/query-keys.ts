import type { GlobalFilters } from '@/types/filter'

export const queryKeys = {
  charts: {
    all: ['charts'] as const,
    list: () => [...queryKeys.charts.all, 'list'] as const,
    data: (chartId: string, filters: GlobalFilters) =>
      [...queryKeys.charts.all, 'data', chartId, filters] as const,
  },
  datasets: {
    all: ['datasets'] as const,
    list: () => [...queryKeys.datasets.all, 'list'] as const,
    schema: (id: number) => [...queryKeys.datasets.all, 'schema', id] as const,
    data: (id: number, filters: GlobalFilters) =>
      [...queryKeys.datasets.all, 'data', id, filters] as const,
  },
  dashboards: {
    all: ['dashboards'] as const,
    list: () => [...queryKeys.dashboards.all, 'list'] as const,
    detail: (id: string) =>
      [...queryKeys.dashboards.all, 'detail', id] as const,
  },
  sql: {
    history: () => ['sql', 'history'] as const,
  },
  search: {
    results: (query: string) => ['search', query] as const,
  },
  export: {
    status: (jobId: string) => ['export', 'status', jobId] as const,
  },
}
