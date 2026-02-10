import { useQueryClient } from '@tanstack/react-query'
import { useChartData } from '@/hooks/use-chart-data'
import { useFilterStore } from '@/stores/filter-store'
import { ChartPanel, ChartPanelSkeleton } from './chart-panel'
import type { ChartConfig, ChartClickEvent } from '@/types/chart'

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
  const { data, isLoading, error } = useChartData(config.id)
  const queryClient = useQueryClient()
  const globalFilters = useFilterStore((s) => s.globalFilters)

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['chart-data', config.id, globalFilters],
    })
  }

  return (
    <ChartPanel
      chartId={config.id}
      config={config}
      data={data}
      isLoading={isLoading}
      error={error ?? null}
      onChartClick={onChartClick}
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
