import { create } from 'zustand'
import type { DrillLevel, DrillState } from '@/types/filter'

interface DrillStore {
  drillState: Record<string, DrillState>

  drillDown: (chartId: string, level: DrillLevel) => void
  drillUp: (chartId: string) => void
  drillToLevel: (chartId: string, level: number) => void
  resetDrill: (chartId: string) => void
}

export const useDrillStore = create<DrillStore>((set) => ({
  drillState: {},

  drillDown: (chartId, level) =>
    set((s) => {
      const existing = s.drillState[chartId] ?? { chartId, levels: [] }
      return {
        drillState: {
          ...s.drillState,
          [chartId]: { ...existing, levels: [...existing.levels, level] },
        },
      }
    }),

  drillUp: (chartId) =>
    set((s) => {
      const existing = s.drillState[chartId]
      if (!existing) return s
      return {
        drillState: {
          ...s.drillState,
          [chartId]: { ...existing, levels: existing.levels.slice(0, -1) },
        },
      }
    }),

  drillToLevel: (chartId, level) =>
    set((s) => {
      const existing = s.drillState[chartId]
      if (!existing) return s
      return {
        drillState: {
          ...s.drillState,
          [chartId]: { ...existing, levels: existing.levels.slice(0, level) },
        },
      }
    }),

  resetDrill: (chartId) =>
    set((s) => ({
      drillState: {
        ...s.drillState,
        [chartId]: { chartId, levels: [] },
      },
    })),
}))
