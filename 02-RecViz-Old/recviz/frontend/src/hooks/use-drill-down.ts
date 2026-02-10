import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useDrillStore } from '@/stores/drill-store'
import { fetchChartData } from '@/lib/api/charts'
import { useFilterStore } from '@/stores/filter-store'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'
import type { DrillLevel } from '@/types/filter'

export function useDrillDown(chartId: string) {
  const drill = useDrillStore((s) => s.drills[chartId])
  const drillDown = useDrillStore((s) => s.drillDown)
  const drillUp = useDrillStore((s) => s.drillUp)
  const resetDrill = useDrillStore((s) => s.resetDrill)
  const globalFilters = useFilterStore((s) => s.globalFilters)

  const currentLevel = drill?.currentLevel ?? -1
  const levels = drill?.levels ?? []
  const currentLevelConfig = currentLevel >= 0 ? levels[currentLevel] : undefined
  const isDetailLevel = currentLevelConfig?.granularity === 'detail'

  const detailQuery = useQuery({
    queryKey: ['drill-detail', chartId, currentLevelConfig?.filters, globalFilters],
    queryFn: () => fetchChartData(chartId, globalFilters),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    enabled: isDetailLevel,
  })

  const handleDrillDown = useCallback(
    (level: DrillLevel) => {
      drillDown(chartId, level)
    },
    [chartId, drillDown],
  )

  const handleDrillUp = useCallback(() => {
    drillUp(chartId)
  }, [chartId, drillUp])

  const handleReset = useCallback(() => {
    resetDrill(chartId)
  }, [chartId, resetDrill])

  return {
    currentLevel,
    breadcrumbs: levels.slice(0, currentLevel + 1),
    drillDown: handleDrillDown,
    drillUp: handleDrillUp,
    reset: handleReset,
    detailQuery: isDetailLevel ? detailQuery : null,
  }
}
