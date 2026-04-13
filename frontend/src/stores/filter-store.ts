import { create } from 'zustand'

import type { CrossFilter, FilterValue } from '@/types/filter'

interface FilterStore {
  // Generic filter values keyed by filter ID
  values: Record<string, FilterValue>
  // Which filter IDs are locked (from URL params)
  locked: Set<string>
  // Snapshot of values at last "Apply" click
  applied: Record<string, FilterValue>

  // Actions
  setFilterValue: (filterId: string, value: FilterValue) => void
  initializeFilters: (defaults: Record<string, FilterValue>, locked?: string[]) => void
  applyFilters: () => void
  resetFilters: (defaults: Record<string, FilterValue>) => void

  // Cross-filters (kept for dashboards that enable them)
  crossFilters: CrossFilter[]
  addCrossFilter: (filter: CrossFilter) => void
  removeCrossFilter: (chartId: string, column: string) => void
  clearCrossFilters: () => void
}

export const useFilterStore = create<FilterStore>((set) => ({
  values: {},
  locked: new Set<string>(),
  applied: {},

  setFilterValue: (filterId, value) =>
    set((s) => ({
      values: { ...s.values, [filterId]: value },
    })),

  initializeFilters: (defaults, locked) =>
    set({
      values: { ...defaults },
      applied: Object.fromEntries(
        Object.entries(defaults).filter(([, v]) => v != null),
      ),
      locked: new Set(locked ?? []),
    }),

  applyFilters: () =>
    set((s) => ({
      applied: Object.fromEntries(
        Object.entries(s.values).filter(([, v]) => v != null),
      ),
    })),

  resetFilters: (defaults) =>
    set((s) => ({
      values: {
        ...defaults,
        // Keep locked filter values unchanged
        ...Object.fromEntries(
          Array.from(s.locked).map((k) => [k, s.values[k]])
        ),
      },
    })),

  crossFilters: [],
  addCrossFilter: (filter) =>
    set((s) => {
      const existing = s.crossFilters.find(
        (f) => f.sourceChartId === filter.sourceChartId && f.column === filter.column
      )
      if (existing && existing.value === filter.value) {
        return {
          crossFilters: s.crossFilters.filter(
            (f) => !(f.sourceChartId === filter.sourceChartId && f.column === filter.column)
          ),
        }
      }
      return {
        crossFilters: [
          ...s.crossFilters.filter(
            (f) => !(f.sourceChartId === filter.sourceChartId && f.column === filter.column)
          ),
          filter,
        ],
      }
    }),

  removeCrossFilter: (chartId, column) =>
    set((s) => ({
      crossFilters: s.crossFilters.filter(
        (f) => !(f.sourceChartId === chartId && f.column === column)
      ),
    })),

  clearCrossFilters: () => set({ crossFilters: [] }),
}))
