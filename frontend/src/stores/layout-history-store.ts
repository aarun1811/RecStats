import { create } from 'zustand'

import type { ChartLayout } from '@/types/dashboard-config'

const MAX_HISTORY = 50

interface LayoutHistoryStore {
  past: ChartLayout[][]
  future: ChartLayout[][]
  canUndo: boolean
  canRedo: boolean

  pushSnapshot: (layouts: ChartLayout[]) => void
  undo: () => ChartLayout[] | null
  redo: () => ChartLayout[] | null
  reset: () => void
}

export const useLayoutHistoryStore = create<LayoutHistoryStore>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushSnapshot: (layouts) =>
    set((s) => {
      const newPast = [...s.past, layouts]
      if (newPast.length > MAX_HISTORY) {
        newPast.splice(0, newPast.length - MAX_HISTORY)
      }
      return {
        past: newPast,
        future: [],
        canUndo: true,
        canRedo: false,
      }
    }),

  undo: () => {
    const s = get()
    if (s.past.length === 0) return null
    const popped = s.past[s.past.length - 1]
    const newPast = s.past.slice(0, -1)
    set({
      past: newPast,
      future: [popped, ...s.future],
      canUndo: newPast.length > 0,
      canRedo: true,
    })
    return popped
  },

  redo: () => {
    const s = get()
    if (s.future.length === 0) return null
    const popped = s.future[0]
    const newFuture = s.future.slice(1)
    set({
      past: [...s.past, popped],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    })
    return popped
  },

  reset: () =>
    set({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    }),
}))
