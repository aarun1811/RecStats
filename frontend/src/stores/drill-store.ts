import { create } from 'zustand'
import type { DrillLevel } from '@/types/filter'

interface PerChartDrill {
  levels: DrillLevel[]
}

interface DrillStore {
  drills: Map<string, PerChartDrill>
  drillDown: (chartId: string, level: DrillLevel) => void
  drillUp: (chartId: string) => void
  drillToLevel: (chartId: string, levelIndex: number) => void
  resetDrill: (chartId: string) => void
  resetAllDrills: () => void
}

export const useDrillStore = create<DrillStore>((set) => ({
  drills: new Map(),

  drillDown: (chartId, level) =>
    set((s) => {
      const next = new Map(s.drills)
      const existing = next.get(chartId)
      if (existing) {
        next.set(chartId, { levels: [...existing.levels, level] })
      } else {
        next.set(chartId, { levels: [level] })
      }
      return { drills: next }
    }),

  drillUp: (chartId) =>
    set((s) => {
      const next = new Map(s.drills)
      const existing = next.get(chartId)
      if (!existing) return s
      const newLevels = existing.levels.slice(0, -1)
      if (newLevels.length === 0) {
        next.delete(chartId)
      } else {
        next.set(chartId, { levels: newLevels })
      }
      return { drills: next }
    }),

  drillToLevel: (chartId, levelIndex) =>
    set((s) => {
      const next = new Map(s.drills)
      if (levelIndex <= 0) {
        next.delete(chartId)
      } else {
        const existing = next.get(chartId)
        if (existing) {
          next.set(chartId, { levels: existing.levels.slice(0, levelIndex) })
        }
      }
      return { drills: next }
    }),

  resetDrill: (chartId) =>
    set((s) => {
      const next = new Map(s.drills)
      next.delete(chartId)
      return { drills: next }
    }),

  resetAllDrills: () =>
    set({ drills: new Map() }),
}))
