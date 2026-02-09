import { ChartPanel } from '@/components/dashboard/chart-panel'
import type { DashboardConfig } from '@/types/api'
import type { ChartClickEvent } from '@/types/chart'

interface ChartGridProps {
  config: DashboardConfig
  loading?: boolean
  onChartNodeClick?: (chartId: string, event: ChartClickEvent) => void
}

export function ChartGrid({
  config,
  loading = false,
  onChartNodeClick,
}: ChartGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {config.charts.map((chartConfig) => (
        <ChartPanel
          key={chartConfig.id}
          chartConfig={chartConfig}
          loading={loading}
          lastUpdated={new Date()}
          onNodeClick={(event) =>
            onChartNodeClick?.(chartConfig.id, event)
          }
        />
      ))}
    </div>
  )
}
