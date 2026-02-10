import { useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChartData } from '@/hooks/use-chart-data'
import { useDrillStore } from '@/stores/drill-store'
import { applyDrillFilters } from '@/hooks/use-drill-down'
import { useFilterStore } from '@/stores/filter-store'
import { applyCrossFilters } from '@/lib/cross-filter'
import { ChartPanel, ChartPanelSkeleton } from './chart-panel'
import { DrillBreadcrumb } from './drill-breadcrumb'
import type { ChartConfig, ChartClickEvent, ChartSelection } from '@/types/chart'

/** The 4 charts rendered on the Recon Overview dashboard. */
const DASHBOARD_CHARTS: ChartConfig[] = [
  {
    id: 'break-trend',
    name: 'Break Trend',
    vizType: 'area',
    datasourceId: 5,
    description: 'Break count over time by status',
  },
  {
    id: 'breaks-by-category',
    name: 'Breaks by Category',
    vizType: 'bar',
    datasourceId: 5,
    description: 'Break distribution by category',
  },
  {
    id: 'breaks-by-desk',
    name: 'Breaks by Desk',
    vizType: 'donut',
    datasourceId: 5,
    description: 'Break distribution across desks',
  },
  {
    id: 'aging-distribution',
    name: 'Aging Distribution',
    vizType: 'bar',
    datasourceId: 5,
    description: 'Break aging buckets',
  },
]

function ChartGridItem({
  config,
  onChartClick,
  onChartDoubleClick,
}: {
  config: ChartConfig
  onChartClick?: (event: ChartClickEvent) => void
  onChartDoubleClick?: (event: ChartClickEvent) => void
}) {
  const { data, isLoading, error } = useChartData(config.id)
  const queryClient = useQueryClient()
  const globalFilters = useFilterStore((s) => s.globalFilters)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const drillLevels = useDrillStore((s) => s.levels)

  // Apply drill filters first (dashboard-wide), then cross-filters
  const drilledData = useMemo(
    () => applyDrillFilters(data, drillLevels),
    [data, drillLevels],
  )

  const filteredData = useMemo(
    () => applyCrossFilters(drilledData, crossFilters, config.id),
    [drilledData, crossFilters, config.id],
  )

  // Highlight selected segment on source chart
  const activeSelection = useMemo((): ChartSelection | undefined => {
    const selfFilter = crossFilters.find((f) => f.sourceChartId === config.id)
    if (!selfFilter) return undefined
    return { column: selfFilter.column, value: selfFilter.value }
  }, [crossFilters, config.id])

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['chart-data', config.id, globalFilters],
    })
  }

  return (
    <ChartPanel
      chartId={config.id}
      config={config}
      data={filteredData}
      isLoading={isLoading}
      error={error ?? null}
      onChartClick={onChartClick}
      onChartDoubleClick={onChartDoubleClick}
      activeSelection={activeSelection}
      onRefresh={handleRefresh}
    />
  )
}

interface ChartGridProps {
  charts?: ChartConfig[]
  onChartClick?: (event: ChartClickEvent) => void
}

export function ChartGrid({ charts, onChartClick }: ChartGridProps) {
  const chartList = charts ?? DASHBOARD_CHARTS
  const drillLevels = useDrillStore((s) => s.levels)
  const drillDown = useDrillStore((s) => s.drillDown)
  const drillUp = useDrillStore((s) => s.drillUp)
  const drillToLevel = useDrillStore((s) => s.drillToLevel)
  const resetDrill = useDrillStore((s) => s.resetDrill)

  const isDetailMode = drillLevels.length >= 3

  const handleDoubleClick = useCallback(
    (event: ChartClickEvent) => {
      drillDown(event.chartId, {
        level: drillLevels.length + 1,
        column: event.column,
        value: String(event.value),
      })
    },
    [drillDown, drillLevels.length],
  )

  // At level 3+, charts hide and grid takes over (handled in dashboard page)
  if (isDetailMode) return null

  return (
    <div className="flex flex-col gap-3">
      {drillLevels.length > 0 && (
        <DrillBreadcrumb
          levels={drillLevels}
          onNavigate={drillToLevel}
          onBack={drillUp}
          onReset={resetDrill}
        />
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {chartList.map((config) => (
          <ChartGridItem
            key={config.id}
            config={config}
            onChartClick={onChartClick}
            onChartDoubleClick={handleDoubleClick}
          />
        ))}
      </div>
    </div>
  )
}

export function ChartGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <ChartPanelSkeleton key={i} />
      ))}
    </div>
  )
}
