import { create } from 'zustand'

import type { DrillLevel } from '@/types/filter'

interface DrillState {
  drills: Record<string, {
    levels: DrillLevel[]
    currentLevel: number
  }>

  drillDown: (chartId: string, level: DrillLevel) => void
  drillUp: (chartId: string) => void
  resetDrill: (chartId: string) => void
  resetAllDrills: () => void
}

export const useDrillStore = create<DrillState>((set) => ({
  drills: {},

  drillDown: (chartId, level) =>
    set((state) => {
      const current = state.drills[chartId] ?? { levels: [], currentLevel: -1 }
      const nextLevel = current.currentLevel + 1
      const levels = [...current.levels.slice(0, nextLevel), level]
      return {
        drills: {
          ...state.drills,
          [chartId]: { levels, currentLevel: nextLevel },
        },
      }
    }),

  drillUp: (chartId) =>
    set((state) => {
      const current = state.drills[chartId]
      if (!current || current.currentLevel <= 0) return state
      return {
        drills: {
          ...state.drills,
          [chartId]: { ...current, currentLevel: current.currentLevel - 1 },
        },
      }
    }),

  resetDrill: (chartId) =>
    set((state) => {
      const { [chartId]: _, ...rest } = state.drills
      return { drills: rest }
    }),

  resetAllDrills: () => set({ drills: {} }),
}))
