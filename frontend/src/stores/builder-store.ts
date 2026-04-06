import { create } from 'zustand'

import type { ChartLayout, DashboardConfig, FilterConfig } from '@/types/dashboard-config'
import type {
  BuilderChartRef,
  BuilderGridRef,
  BuilderItem,
  BuilderKpiRef,
} from '@/types/builder'

interface BuilderStore {
  // State
  dashboardId: string | null
  name: string
  description: string
  items: BuilderItem[]
  filters: FilterConfig[]
  isDirty: boolean

  // Actions
  initNew: () => void
  initFromConfig: (id: string, config: DashboardConfig) => void
  updateName: (name: string) => void
  updateDescription: (desc: string) => void
  addItem: (item: BuilderItem) => void
  removeItem: (itemId: string) => void
  updateLayouts: (layouts: Array<{ id: string; layout: ChartLayout }>) => void
  updateItemConfig: (
    itemId: string,
    updates: Partial<BuilderChartRef> | Partial<BuilderKpiRef> | Partial<BuilderGridRef>,
  ) => void
  addFilter: (filter: FilterConfig) => void
  removeFilter: (filterId: string) => void
  updateFilter: (filterId: string, updates: Partial<FilterConfig>) => void
  reorderFilters: (orderedIds: string[]) => void
  markClean: () => void
}

function buildItemsFromConfig(config: DashboardConfig): BuilderItem[] {
  const items: BuilderItem[] = []

  for (const kpi of config.kpis) {
    items.push({
      id: kpi.id,
      type: 'kpi',
      layout: { col: 0, row: 0, width: 3, height: 2 },
      kpi: {
        kpiId: kpi.id,
        title: kpi.label,
      },
    })
  }

  for (const chart of config.charts) {
    items.push({
      id: chart.id,
      type: 'chart',
      layout: { ...chart.layout },
      chart: {
        chartId: chart.id,
        chartType: chart.type,
        datasetId: chart.sources?.[0]?.dataSourceId ?? '',
        title: chart.title,
        crossFilter: chart.crossFilter ?? false,
        drillHierarchy: chart.drillHierarchy ?? [],
        drillDetailDataSourceId: chart.drillDetailDataSourceId ?? null,
        refreshInterval: chart.refreshInterval ?? null,
      },
    })
  }

  for (const grid of config.grids) {
    items.push({
      id: grid.id,
      type: 'grid',
      layout: { ...grid.layout },
      grid: {
        datasetId: grid.dataSourceId ?? grid.sources?.[0]?.dataSourceId ?? '',
        title: grid.title,
        visibleColumns: null,
        defaultSortColumn: null,
        defaultSortDirection: 'asc',
        rowLimit: 100,
      },
    })
  }

  return items
}

export const useBuilderStore = create<BuilderStore>((set) => ({
  dashboardId: null,
  name: '',
  description: '',
  items: [],
  filters: [],
  isDirty: false,

  initNew: () =>
    set({
      dashboardId: null,
      name: '',
      description: '',
      items: [],
      filters: [],
      isDirty: false,
    }),

  initFromConfig: (id, config) =>
    set({
      dashboardId: id,
      name: config.name,
      description: config.description,
      items: buildItemsFromConfig(config),
      filters: config.filters.map((f) => ({ ...f })),
      isDirty: false,
    }),

  updateName: (name) => set({ name, isDirty: true }),

  updateDescription: (desc) => set({ description: desc, isDirty: true }),

  addItem: (item) =>
    set((s) => ({ items: [...s.items, item], isDirty: true })),

  removeItem: (itemId) =>
    set((s) => ({
      items: s.items.filter((i) => i.id !== itemId),
      isDirty: true,
    })),

  updateLayouts: (layouts) =>
    set((s) => {
      const layoutMap = new Map(layouts.map((l) => [l.id, l.layout]))
      return {
        items: s.items.map((item) => {
          const newLayout = layoutMap.get(item.id)
          if (!newLayout) return item
          return { ...item, layout: newLayout }
        }),
        isDirty: true,
      }
    }),

  updateItemConfig: (itemId, updates) =>
    set((s) => ({
      items: s.items.map((item) => {
        if (item.id !== itemId) return item
        if (item.type === 'chart' && item.chart) {
          return { ...item, chart: { ...item.chart, ...updates } }
        }
        if (item.type === 'kpi' && item.kpi) {
          return { ...item, kpi: { ...item.kpi, ...updates } }
        }
        if (item.type === 'grid' && item.grid) {
          return { ...item, grid: { ...item.grid, ...updates } }
        }
        return item
      }),
      isDirty: true,
    })),

  addFilter: (filter) =>
    set((s) => ({ filters: [...s.filters, filter], isDirty: true })),

  removeFilter: (filterId) =>
    set((s) => ({
      filters: s.filters.filter((f) => f.id !== filterId),
      isDirty: true,
    })),

  updateFilter: (filterId, updates) =>
    set((s) => ({
      filters: s.filters.map((f) =>
        f.id === filterId ? { ...f, ...updates } : f,
      ),
      isDirty: true,
    })),

  reorderFilters: (orderedIds) =>
    set((s) => {
      const filterMap = new Map(s.filters.map((f) => [f.id, f]))
      const reordered = orderedIds
        .map((id) => filterMap.get(id))
        .filter((f): f is FilterConfig => f != null)
      return { filters: reordered, isDirty: true }
    }),

  markClean: () => set({ isDirty: false }),
}))
