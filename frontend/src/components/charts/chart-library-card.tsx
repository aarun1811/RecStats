import { formatDistanceToNow } from 'date-fns'

import { Card } from '@/components/ui/card'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import type { RecvizChart } from '@/types/managed-chart'

interface ChartLibraryCardProps {
  chart: RecvizChart
  datasetName: string
  onClick: () => void
}

export function ChartLibraryCard({ chart, datasetName, onClick }: ChartLibraryCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
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
      <div className="h-[120px] bg-muted/30 flex items-center justify-center rounded-t-lg">
        <ChartTypeIcon chartType={chart.chartType} size={48} className="text-muted-foreground/30" />
      </div>
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ChartTypeIcon chartType={chart.chartType} size={20} className="shrink-0 text-muted-foreground" />
          <p className="text-sm font-semibold truncate">{chart.name}</p>
        </div>
        {chart.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{chart.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {datasetName} &middot; {CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(chart.updatedAt), { addSuffix: true })}
        </p>
      </div>
    </Card>
  )
}
