import { AlertTriangle } from 'lucide-react'

interface UnsupportedChartErrorProps {
  vizType: string
}

const SUPPORTED_TYPES = 'bar, line, area, pie, donut, scatter, heatmap, treemap, waterfall, combo, sankey, sunburst, radar, gauge, funnel, graph, parallel'

export function UnsupportedChartError({ vizType }: UnsupportedChartErrorProps) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
      <AlertTriangle className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Unsupported chart type</p>
      <p className="max-w-[300px] text-xs text-muted-foreground">
        Chart type &apos;{vizType}&apos; is not supported. Supported types: {SUPPORTED_TYPES}.
      </p>
    </div>
  )
}
