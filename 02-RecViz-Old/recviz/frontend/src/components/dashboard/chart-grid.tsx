import { ChartFactory } from '@/components/charts/chart-factory'
import { ChartPanel } from '@/components/dashboard/chart-panel'
import { useChartData } from '@/hooks/use-chart-data'
import type { DashboardConfig } from '@/types/api'
import type { ChartConfig, ChartClickEvent } from '@/types/chart'

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
        <ChartWithData
          key={chartConfig.id}
          chartConfig={chartConfig}
          loading={loading}
          onNodeClick={(event) =>
            onChartNodeClick?.(chartConfig.id, event)
          }
        />
      ))}
    </div>
  )
}

interface ChartWithDataProps {
  chartConfig: ChartConfig
  loading?: boolean
  onNodeClick?: (event: ChartClickEvent) => void
}

function ChartWithData({ chartConfig, loading, onNodeClick }: ChartWithDataProps) {
  const { data: chartData, isLoading: dataLoading, refetch } = useChartData(chartConfig.id)

  const isLoading = loading || dataLoading

  return (
    <ChartPanel
      chartConfig={chartConfig}
      loading={isLoading}
      lastUpdated={new Date()}
      onNodeClick={onNodeClick}
      onRefresh={() => refetch()}
    >
      {chartData && chartData.data.length > 0 && (
        <ChartFactory
          chartType={chartConfig.type}
          config={chartConfig}
          data={chartData.data}
          onNodeClick={onNodeClick}
        />
      )}
    </ChartPanel>
  )
}
