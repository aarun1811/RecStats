import { describe, it, expect, beforeEach } from 'vitest'
import { useFilterStore } from './filter-store'

describe('filter-store crossFilters', () => {
  beforeEach(() => {
    // Reset store state before each test
    useFilterStore.setState({
      crossFilters: [],
      values: {},
      locked: new Set<string>(),
      applied: {},
    })
  })

  describe('addCrossFilter', () => {
    it('toggles: same sourceChartId+column+value removes the filter', () => {
      const { addCrossFilter } = useFilterStore.getState()

      addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
      expect(useFilterStore.getState().crossFilters).toHaveLength(1)

      // Same exact filter again -- should toggle off
      addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
      expect(useFilterStore.getState().crossFilters).toHaveLength(0)
    })

    it('replaces: same sourceChartId+column but different value replaces', () => {
      const { addCrossFilter } = useFilterStore.getState()

      addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
      expect(useFilterStore.getState().crossFilters).toHaveLength(1)
      expect(useFilterStore.getState().crossFilters[0].value).toBe('APAC')

      // Same chart+column, different value -- should replace
      addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'EMEA' })
      expect(useFilterStore.getState().crossFilters).toHaveLength(1)
      expect(useFilterStore.getState().crossFilters[0].value).toBe('EMEA')
    })

    it('adds filters from different charts independently', () => {
      const { addCrossFilter } = useFilterStore.getState()

      addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
      addCrossFilter({ sourceChartId: 'chart-b', column: 'desk', value: 'FX' })

      expect(useFilterStore.getState().crossFilters).toHaveLength(2)
    })
  })

  describe('removeCrossFilter', () => {
    it('removes by chartId+column', () => {
      useFilterStore.setState({
        crossFilters: [
          { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
          { sourceChartId: 'chart-b', column: 'desk', value: 'FX' },
        ],
      })

      useFilterStore.getState().removeCrossFilter('chart-a', 'region')
      expect(useFilterStore.getState().crossFilters).toHaveLength(1)
      expect(useFilterStore.getState().crossFilters[0].sourceChartId).toBe('chart-b')
    })
  })

  describe('clearCrossFilters', () => {
    it('empties the array', () => {
      useFilterStore.setState({
        crossFilters: [
          { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
          { sourceChartId: 'chart-b', column: 'desk', value: 'FX' },
        ],
      })

      useFilterStore.getState().clearCrossFilters()
      expect(useFilterStore.getState().crossFilters).toHaveLength(0)
    })
  })
})
