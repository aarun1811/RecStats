import { ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import type { RecvizChart } from '@/types/managed-chart'

interface ChartLibraryRowProps {
  chart: RecvizChart
  datasetName: string
  onClick: () => void
}

export function ChartLibraryRow({ chart, datasetName, onClick }: ChartLibraryRowProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50"
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
      <ChartTypeIcon chartType={chart.chartType} size={20} className="shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{chart.name}</p>
        {chart.description && (
          <p className="text-xs text-muted-foreground truncate">{chart.description}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{datasetName}</span>
      <Badge variant="outline">{CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType}</Badge>
      <span className="text-xs text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(chart.updatedAt), { addSuffix: true })}
      </span>
      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
    </div>
  )
}
