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

describe('filter-store initializeFilters', () => {
  beforeEach(() => {
    useFilterStore.setState({
      crossFilters: [],
      values: {},
      locked: new Set<string>(),
      applied: {},
    })
  })

  it('populates BOTH values AND applied so child queries do not fire with empty filters', () => {
    // Regression: previously the embed page fired 5 spurious 400s because
    // dataset queries read `applied` on first render before any subsequent
    // applyFilters() ran. The fix requires initializeFilters to seed both
    // sides synchronously, so any consumer that reads `applied` after init
    // sees the URL-supplied filters.
    useFilterStore.getState().initializeFilters({
      tlm_instance: 'TLMP_CONSUMER',
      recon: 'RECON-RATES-LATAM-000008',
    })

    const state = useFilterStore.getState()
    expect(state.values.tlm_instance).toBe('TLMP_CONSUMER')
    expect(state.values.recon).toBe('RECON-RATES-LATAM-000008')
    expect(state.applied.tlm_instance).toBe('TLMP_CONSUMER')
    expect(state.applied.recon).toBe('RECON-RATES-LATAM-000008')
  })

  it('filters out null/undefined values from applied (but preserves them in values for the form)', () => {
    // The signature says Record<string, FilterValue> but in practice optional
    // URL filters can arrive as `undefined`; the runtime guard `v != null`
    // is the load-bearing piece for the embed-init race fix.
    const partial = {
      tlm_instance: 'TLMP_CONSUMER',
      recon: undefined as unknown as string,
    }
    useFilterStore.getState().initializeFilters(partial)

    const state = useFilterStore.getState()
    expect(state.applied.tlm_instance).toBe('TLMP_CONSUMER')
    expect('recon' in state.applied).toBe(false)
  })

  it('records locked filter ids in the locked Set', () => {
    useFilterStore.getState().initializeFilters(
      { tlm_instance: 'TLMP_CONSUMER', recon: 'X' },
      ['tlm_instance', 'recon'],
    )

    const state = useFilterStore.getState()
    expect(state.locked.has('tlm_instance')).toBe(true)
    expect(state.locked.has('recon')).toBe(true)
  })
})
