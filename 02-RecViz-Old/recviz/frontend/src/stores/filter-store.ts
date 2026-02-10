import { create } from 'zustand'

import type { GlobalFilters, CrossFilter } from '@/types/filter'

interface FilterState {
  globalFilters: GlobalFilters
  crossFilters: Record<string, CrossFilter>

  setGlobalFilter: <K extends keyof GlobalFilters>(
    key: K,
    value: GlobalFilters[K],
  ) => void
  setGlobalFilters: (filters: Partial<GlobalFilters>) => void
  resetGlobalFilters: () => void

  setCrossFilter: (chartId: string, field: string, value: string | string[]) => void
  removeCrossFilter: (chartId: string) => void
  clearCrossFilters: () => void
}

const defaultGlobalFilters: GlobalFilters = {
  dateRange: {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  },
  entities: [],
  statuses: [],
  desks: [],
}

export const useFilterStore = create<FilterState>((set) => ({
  globalFilters: defaultGlobalFilters,
  crossFilters: {},

  setGlobalFilter: (key, value) =>
    set((state) => ({
      globalFilters: { ...state.globalFilters, [key]: value },
    })),

  setGlobalFilters: (filters) =>
    set((state) => ({
      globalFilters: { ...state.globalFilters, ...filters },
    })),

  resetGlobalFilters: () =>
    set({ globalFilters: defaultGlobalFilters, crossFilters: {} }),

  setCrossFilter: (chartId, field, value) =>
    set((state) => ({
      crossFilters: {
        ...state.crossFilters,
        [chartId]: { chartId, field, value },
      },
    })),

  removeCrossFilter: (chartId) =>
    set((state) => {
      const { [chartId]: _, ...rest } = state.crossFilters
      return { crossFilters: rest }
    }),

  clearCrossFilters: () => set({ crossFilters: {} }),
}))
