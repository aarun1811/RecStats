import { describe, it, expect, beforeEach } from 'vitest'
import { useDrillStore } from './drill-store'

describe('drill-store (per-chart)', () => {
  beforeEach(() => {
    useDrillStore.setState({ drills: new Map() })
  })

  describe('drillDown', () => {
    it('adds a level to a specific chart drill state', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })

      const drill = useDrillStore.getState().drills.get('chart-a')
      expect(drill).toBeDefined()
      expect(drill!.levels).toHaveLength(1)
      expect(drill!.levels[0]).toEqual({ column: 'region', value: 'APAC' })
    })

    it('maintains independent states for different charts', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillDown('chart-b', { column: 'desk', value: 'FX' })

      const drillA = useDrillStore.getState().drills.get('chart-a')
      const drillB = useDrillStore.getState().drills.get('chart-b')
      expect(drillA!.levels).toHaveLength(1)
      expect(drillB!.levels).toHaveLength(1)
      expect(drillA!.levels[0].column).toBe('region')
      expect(drillB!.levels[0].column).toBe('desk')
    })

    it('appends levels for the same chart', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillDown('chart-a', { column: 'desk', value: 'FX' })

      const drill = useDrillStore.getState().drills.get('chart-a')
      expect(drill!.levels).toHaveLength(2)
      expect(drill!.levels[0].column).toBe('region')
      expect(drill!.levels[1].column).toBe('desk')
    })
  })

  describe('drillUp', () => {
    it('removes last level for a specific chart', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillDown('chart-a', { column: 'desk', value: 'FX' })

      useDrillStore.getState().drillUp('chart-a')

      const drill = useDrillStore.getState().drills.get('chart-a')
      expect(drill!.levels).toHaveLength(1)
      expect(drill!.levels[0].column).toBe('region')
    })

    it('removes the map entry when last level is removed', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillUp('chart-a')

      expect(useDrillStore.getState().drills.has('chart-a')).toBe(false)
    })

    it('does not affect other charts', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillDown('chart-b', { column: 'desk', value: 'FX' })

      useDrillStore.getState().drillUp('chart-a')

      expect(useDrillStore.getState().drills.has('chart-a')).toBe(false)
      expect(useDrillStore.getState().drills.get('chart-b')!.levels).toHaveLength(1)
    })
  })

  describe('drillToLevel', () => {
    it('truncates levels array for a specific chart', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillDown('chart-a', { column: 'desk', value: 'FX' })
      useDrillStore.getState().drillDown('chart-a', { column: 'bucket', value: '30-60' })

      useDrillStore.getState().drillToLevel('chart-a', 1)

      const drill = useDrillStore.getState().drills.get('chart-a')
      expect(drill!.levels).toHaveLength(1)
      expect(drill!.levels[0].column).toBe('region')
    })

    it('removes entry when navigating to level 0', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillToLevel('chart-a', 0)

      expect(useDrillStore.getState().drills.has('chart-a')).toBe(false)
    })
  })

  describe('resetDrill', () => {
    it('clears a specific chart drill state', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillDown('chart-b', { column: 'desk', value: 'FX' })

      useDrillStore.getState().resetDrill('chart-a')

      expect(useDrillStore.getState().drills.has('chart-a')).toBe(false)
      expect(useDrillStore.getState().drills.has('chart-b')).toBe(true)
    })
  })

  describe('resetAllDrills', () => {
    it('clears all chart drill states', () => {
      useDrillStore.getState().drillDown('chart-a', { column: 'region', value: 'APAC' })
      useDrillStore.getState().drillDown('chart-b', { column: 'desk', value: 'FX' })

      useDrillStore.getState().resetAllDrills()

      expect(useDrillStore.getState().drills.size).toBe(0)
    })
  })
})
