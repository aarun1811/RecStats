import { create } from 'zustand'
import type { DrillLevel } from '@/types/filter'

interface DrillStore {
  /** Which chart initiated the drill. */
  sourceChartId: string | null
  /** The breadcrumb stack of drill levels. */
  levels: DrillLevel[]

  drillDown: (chartId: string, level: DrillLevel) => void
  drillUp: () => void
  drillToLevel: (level: number) => void
  resetDrill: () => void
}

export const useDrillStore = create<DrillStore>((set) => ({
  sourceChartId: null,
  levels: [],

  drillDown: (chartId, level) =>
    set((s) => ({
      sourceChartId: s.sourceChartId ?? chartId,
      levels: [...s.levels, level],
    })),

  drillUp: () =>
    set((s) => {
      const newLevels = s.levels.slice(0, -1)
      return {
        levels: newLevels,
        sourceChartId: newLevels.length === 0 ? null : s.sourceChartId,
      }
    }),

  drillToLevel: (level) =>
    set((s) => {
      const newLevels = s.levels.slice(0, level)
      return {
        levels: newLevels,
        sourceChartId: newLevels.length === 0 ? null : s.sourceChartId,
      }
    }),

  resetDrill: () => set({ sourceChartId: null, levels: [] }),
}))
