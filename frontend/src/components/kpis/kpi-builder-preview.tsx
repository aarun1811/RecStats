import { useMemo } from 'react'
import { Gauge } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'
import { computeAggregation } from '@/lib/kpi-utils'
import { KpiPreviewCard } from './kpi-preview-card'
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
  dataset,
  metricColumn,
  aggregation,
  format,
  trend,
  thresholds,
  subtitle,
  name,
}: KpiBuilderPreviewProps) {
  const { data: rawResult, isLoading } = useQuery({
    queryKey: ['kpi-preview-data', datasetId],
    queryFn: () =>
      api.post<{ columns: string[]; data: Record<string, unknown>[] }>(
        '/api/sql/execute',
        {
          database_id: dataset?.databaseId,
          sql: dataset?.sql,
          limit: 10000,
        },
      ),
    enabled: dataset !== undefined && dataset !== null,
    staleTime: 5 * 60 * 1000,
  })

  const computedValue = useMemo(() => {
    if (!rawResult?.data?.length || !metricColumn) return 0
    const values = rawResult.data
      .map((row: Record<string, unknown>) => Number(row[metricColumn]))
      .filter((v: number) => !isNaN(v))
    return computeAggregation(values, aggregation)
  }, [rawResult, metricColumn, aggregation])

  const rowCount = rawResult?.data?.length ?? 0

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
    <div className="flex flex-col gap-6 h-full">
      {/* Live KPI card */}
      <div className="flex items-center justify-center flex-1 min-h-0">
        <div className="w-full max-w-xs">
          <KpiPreviewCard
            name={name}
            value={computedValue}
            isLoading={isLoading}
            format={format}
            trend={trend}
            trendPercentage={null}
            thresholds={thresholds}
            subtitle={subtitle}
          />
        </div>
      </div>

      {/* Summary section */}
      <div className="shrink-0 rounded-md border bg-muted/30 px-4 py-3 space-y-1.5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Configuration Summary
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Dataset</span>
          <span className="truncate">{dataset?.name ?? 'Not selected'}</span>

          <span className="text-muted-foreground">Column</span>
          <span className="truncate font-mono text-xs">
            {metricColumn ?? 'Not selected'}
          </span>

          <span className="text-muted-foreground">Aggregation</span>
          <span>{aggregation}</span>

          {rawResult && (
            <>
              <span className="text-muted-foreground">Rows sampled</span>
              <span>{rowCount.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
