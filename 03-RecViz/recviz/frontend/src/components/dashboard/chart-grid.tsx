import { useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChartData } from '@/hooks/use-chart-data'
import { useDrillDown } from '@/hooks/use-drill-down'
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
}: {
  config: ChartConfig
  onChartClick?: (event: ChartClickEvent) => void
}) {
  const { data: baseData, isLoading, error } = useChartData(config.id)
  const { levels, data: drilledData, drill, back, reset, navigateTo } = useDrillDown(config.id)
  const queryClient = useQueryClient()
  const globalFilters = useFilterStore((s) => s.globalFilters)
  const crossFilters = useFilterStore((s) => s.crossFilters)

  // Use drilled data if drilling, otherwise base data
  const chartData = levels.length > 0 ? drilledData : baseData

  // Apply cross-filters client-side (exclude self-chart)
  const filteredData = useMemo(
    () => applyCrossFilters(chartData, crossFilters, config.id),
    [chartData, crossFilters, config.id],
  )

  // Highlight selected segment on source chart
  const activeSelection = useMemo((): ChartSelection | undefined => {
    const selfFilter = crossFilters.find((f) => f.sourceChartId === config.id)
    if (!selfFilter) return undefined
    return { column: selfFilter.column, value: selfFilter.value }
  }, [crossFilters, config.id])

  const handleDoubleClick = useCallback(
    (event: ChartClickEvent) => {
      drill(event.column, String(event.value))
    },
    [drill],
  )

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['chart-data', config.id, globalFilters],
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <DrillBreadcrumb
        levels={levels}
        onNavigate={navigateTo}
        onBack={back}
        onReset={reset}
      />
      <ChartPanel
        chartId={config.id}
        config={config}
        data={filteredData}
        isLoading={isLoading}
        error={error ?? null}
        onChartClick={onChartClick}
        onChartDoubleClick={handleDoubleClick}
        activeSelection={activeSelection}
        drillLevels={levels}
        onRefresh={handleRefresh}
      />
    </div>
  )
}

interface ChartGridProps {
  charts?: ChartConfig[]
  onChartClick?: (event: ChartClickEvent) => void
}

export function ChartGrid({ charts, onChartClick }: ChartGridProps) {
  const chartList = charts ?? DASHBOARD_CHARTS

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {chartList.map((config) => (
        <ChartGridItem
          key={config.id}
          config={config}
          onChartClick={onChartClick}
        />
      ))}
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
