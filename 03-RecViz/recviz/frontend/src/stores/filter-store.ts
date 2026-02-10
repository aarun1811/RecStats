import { create } from 'zustand'
import type { CrossFilter, DrillState, GlobalFilters } from '@/types/filter'

interface FilterState {
  globalFilters: GlobalFilters
  crossFilters: CrossFilter[]
  drillStates: Record<string, DrillState>

  setGlobalFilters: (filters: GlobalFilters) => void
  updateGlobalFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void
  resetGlobalFilters: () => void

  addCrossFilter: (filter: CrossFilter) => void
  removeCrossFilter: (sourceChartId: string) => void
  clearCrossFilters: () => void

  pushDrill: (chartId: string, level: { level: number; column: string; value: string }) => void
  popDrill: (chartId: string) => void
  resetDrill: (chartId: string) => void
}

const EMPTY_FILTERS: GlobalFilters = {}

export const useFilterStore = create<FilterState>((set) => ({
  globalFilters: EMPTY_FILTERS,
  crossFilters: [],
  drillStates: {},

  setGlobalFilters: (filters) => set({ globalFilters: filters }),

  updateGlobalFilter: (key, value) =>
    set((s) => ({ globalFilters: { ...s.globalFilters, [key]: value } })),

  resetGlobalFilters: () => set({ globalFilters: EMPTY_FILTERS }),

  addCrossFilter: (filter) =>
    set((s) => ({
      crossFilters: [
        ...s.crossFilters.filter((f) => f.sourceChartId !== filter.sourceChartId),
        filter,
      ],
    })),

  removeCrossFilter: (sourceChartId) =>
    set((s) => ({
      crossFilters: s.crossFilters.filter((f) => f.sourceChartId !== sourceChartId),
    })),

  clearCrossFilters: () => set({ crossFilters: [] }),

  pushDrill: (chartId, level) =>
    set((s) => {
      const existing = s.drillStates[chartId] ?? { chartId, levels: [] }
      return {
        drillStates: {
          ...s.drillStates,
          [chartId]: { ...existing, levels: [...existing.levels, level] },
        },
      }
    }),

  popDrill: (chartId) =>
    set((s) => {
      const existing = s.drillStates[chartId]
      if (!existing) return s
      return {
        drillStates: {
          ...s.drillStates,
          [chartId]: { ...existing, levels: existing.levels.slice(0, -1) },
        },
      }
    }),

  resetDrill: (chartId) =>
    set((s) => ({
      drillStates: {
        ...s.drillStates,
        [chartId]: { chartId, levels: [] },
      },
    })),
}))
