import { Gauge } from 'lucide-react'

import type { AggregationType, KpiFormatConfig, TrendConfig, ThresholdConfig } from '@/types/managed-kpi'
import type { RecvizDataset } from '@/types/managed-dataset'

interface KpiBuilderPreviewProps {
  datasetId: string | null
  dataset: RecvizDataset | null
  metricColumn: string | null
  aggregation: AggregationType
  format: KpiFormatConfig
  trend: TrendConfig | null
  thresholds: ThresholdConfig | null
  subtitle: string
  name: string
}

export function KpiBuilderPreview({
  datasetId,
}: KpiBuilderPreviewProps) {
  if (!datasetId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 h-full">
        <Gauge className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Select a dataset to see preview
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">Preview loading...</p>
    </div>
  )
}
