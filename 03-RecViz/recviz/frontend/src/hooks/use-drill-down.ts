import { useCallback } from 'react'
import { useFilterStore } from '@/stores/filter-store'
import { useChartDataWithFilters } from './use-chart-data'
import type { GlobalFilters } from '@/types/filter'

/**
 * Manages drill-down state for a chart.
 * Each drill level adds a filter constraint and fetches new data.
 */
export function useDrillDown(chartId: string) {
  const drillState = useFilterStore((s) => s.drillStates[chartId])
  const globalFilters = useFilterStore((s) => s.globalFilters)
  const pushDrill = useFilterStore((s) => s.pushDrill)
  const popDrill = useFilterStore((s) => s.popDrill)
  const resetDrill = useFilterStore((s) => s.resetDrill)

  const levels = drillState?.levels ?? []

  // Build filters including drill constraints
  const drillFilters: GlobalFilters = {
    ...globalFilters,
    ...Object.fromEntries(
      levels.map((l) => [l.column, [l.value]]),
    ),
  }

  // Fetch data with drill filters applied
  const { data, isLoading } = useChartDataWithFilters(
    chartId,
    drillFilters,
    levels.length > 0,
  )

  const drill = useCallback(
    (column: string, value: string) => {
      pushDrill(chartId, { level: levels.length + 1, column, value })
    },
    [chartId, levels.length, pushDrill],
  )

  const back = useCallback(() => popDrill(chartId), [chartId, popDrill])
  const reset = useCallback(() => resetDrill(chartId), [chartId, resetDrill])

  return {
    levels,
    depth: levels.length,
    data,
    isLoading,
    drill,
    back,
    reset,
    canGoBack: levels.length > 0,
  }
}
