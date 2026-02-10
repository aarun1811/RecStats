import { create } from 'zustand'
import type { CrossFilter, GlobalFilters } from '@/types/filter'

interface FilterState {
  globalFilters: GlobalFilters
  crossFilters: CrossFilter[]

  // Global filters
  setGlobalFilters: (filters: GlobalFilters) => void
  updateGlobalFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void
  applyFilters: () => void
  resetGlobalFilters: () => void

  // Cross filters
  addCrossFilter: (filter: CrossFilter) => void
  removeCrossFilter: (sourceChartId: string) => void
  clearCrossFilters: () => void
}

const DEFAULT_FILTERS: GlobalFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  status: [],
  desk: [],
  lob: [],
  region: [],
  country: [],
  currency: [],
  counterparty: [],
}

export const useFilterStore = create<FilterState>((set) => ({
  globalFilters: { ...DEFAULT_FILTERS },
  crossFilters: [],

  setGlobalFilters: (filters) => set({ globalFilters: filters }),

  updateGlobalFilter: (key, value) =>
    set((s) => ({ globalFilters: { ...s.globalFilters, [key]: value } })),

  applyFilters: () => {
    // Trigger re-fetches by creating a new reference.
    // TanStack Query hooks read globalFilters from the store, so they auto-refetch
    // when query keys change. This method exists as an explicit "apply" action.
    set((s) => ({ globalFilters: { ...s.globalFilters } }))
  },

  resetGlobalFilters: () => set({ globalFilters: { ...DEFAULT_FILTERS } }),

  addCrossFilter: (filter) =>
    set((s) => {
      // Toggle: clicking the same chart+value removes the filter
      const existing = s.crossFilters.find(
        (f) => f.sourceChartId === filter.sourceChartId && f.column === filter.column && f.value === filter.value,
      )
      if (existing) {
        return { crossFilters: s.crossFilters.filter((f) => f !== existing) }
      }
      return {
        crossFilters: [
          ...s.crossFilters.filter((f) => f.sourceChartId !== filter.sourceChartId),
          filter,
        ],
      }
    }),

  removeCrossFilter: (sourceChartId) =>
    set((s) => ({
      crossFilters: s.crossFilters.filter((f) => f.sourceChartId !== sourceChartId),
    })),

  clearCrossFilters: () => set({ crossFilters: [] }),
}))
