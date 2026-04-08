import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { ChartFactory } from '@/components/charts/chart-factory'
import type { RecvizChart } from '@/types/managed-chart'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { ChartConfig, ChartDataResponse } from '@/types/chart'

interface ChartLibraryCardProps {
  chart: RecvizChart
  dataset?: RecvizDataset
  datasetName: string
  onClick: () => void
}

export function ChartLibraryCard({ chart, dataset, datasetName, onClick }: ChartLibraryCardProps) {
  const { data: rawResult, isLoading } = useQuery({
    queryKey: ['chart-thumbnail', chart.datasetId],
    queryFn: () =>
      api.post<{ columns: unknown[]; data: Record<string, unknown>[] }>(
        '/api/sql/execute',
        {
          database_id: dataset?.databaseId,
          sql: dataset?.sql,
          limit: 200,
        },
      ),
    enabled: dataset !== undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const chartConfig = useMemo<ChartConfig>(() => ({
    id: chart.id,
    name: chart.name,
    vizType: chart.chartType,
    datasourceId: 0,
    metricColumns: chart.config.columnMapping.metricColumns,
    categoryColumn: chart.config.columnMapping.categoryColumn ?? undefined,
    appearance: { showLegend: false, interactive: false },
  }), [chart])

  const chartData = useMemo<ChartDataResponse | undefined>(() => {
    if (!rawResult?.data?.length) return undefined
    const columns = (rawResult.columns ?? Object.keys(rawResult.data[0]))
      .map((col: unknown) =>
        typeof col === 'string' ? col : (col as Record<string, string>).column_name ?? (col as Record<string, string>).name ?? String(col),
      )
    return {
      chartId: chart.id,
      columns,
      data: rawResult.data,
      rowCount: rawResult.data.length,
    }
  }, [rawResult, chart.id])

  const timeAgo = formatDistanceToNow(new Date(chart.updatedAt), { addSuffix: true })
  const displayType = CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-card',
        'cursor-pointer transition-all duration-200',
        'hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
      )}
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Thumbnail — the hero */}
      <div className="relative h-[180px] overflow-hidden">
        {/* Chart render */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/5">
            <Skeleton className="h-3/4 w-3/4 rounded" />
          </div>
        )}
        {!isLoading && chartData && (
          <div className="absolute inset-0">
            <ChartFactory
              chartId={`thumb-${chart.id}`}
              config={chartConfig}
              data={chartData}
              isLoading={false}
            />
          </div>
        )}
        {!isLoading && !chartData && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/5">
            <ChartTypeIcon chartType={chart.chartType} size={40} className="text-muted-foreground/15" />
          </div>
        )}

        {/* Interaction blocker — transparent overlay above the canvas to eat all mouse events */}
        <div className="absolute inset-0 z-50" />

        {/* Bottom fade — masks chart labels bleeding into metadata */}
        <div className="absolute inset-x-0 bottom-0 h-10 z-50 bg-gradient-to-t from-card to-transparent" />

        {/* Chart type pill — top right */}
        <div className="absolute top-2.5 right-2.5 z-50 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm border border-border/50">
          <ChartTypeIcon chartType={chart.chartType} size={10} />
          {displayType}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-0.5 px-3.5 py-3">
        <p className="text-sm font-semibold truncate leading-snug">{chart.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {datasetName}
          <span className="mx-1.5 opacity-40">&middot;</span>
          {timeAgo}
        </p>
      </div>
    </div>
  )
}
