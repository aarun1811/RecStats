import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gauge } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { CountAnimation } from '@/components/shared/count-animation'
import {
  computeAggregation,
  getThresholdLevel,
  THRESHOLD_STYLES,
} from '@/lib/kpi-utils'
import type { AggregationType, KpiFormatConfig, TrendConfig, ThresholdConfig } from '@/types/managed-kpi'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { FormatNumberOptions } from '@/types/formatting'

export type KpiBuilderStep = 'dataset' | 'column' | 'format' | 'trend' | 'thresholds' | ''

interface KpiBuilderPreviewProps {
  step: KpiBuilderStep
  datasetId: string | null
  dataset: RecvizDataset | null
  metricColumn: string | null
  aggregation: AggregationType
  format: KpiFormatConfig
  trend: TrendConfig | null
  thresholds: ThresholdConfig | null
  subtitle: string
  name: string
  allComplete?: boolean
}

export function KpiBuilderPreview({
  step,
  datasetId,
  dataset,
  metricColumn,
  aggregation,
  format,
  trend,
  thresholds,
  subtitle,
  name,
  allComplete,
}: KpiBuilderPreviewProps) {
  const [sampleData, setSampleData] = useState<Record<string, unknown>[] | null>(null)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)

  // Reset sample data when dataset changes
  useEffect(() => {
    setSampleData(null)
    setSampleError(null)
  }, [dataset?.id])

  const { data: rawResult, isLoading: valueLoading } = useQuery({
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

  const thresholdLevel = getThresholdLevel(computedValue, thresholds)
  const thresholdColor = THRESHOLD_STYLES[thresholdLevel]

  const formatOptions: FormatNumberOptions = {
    type: format.type,
    decimals: format.decimals ?? undefined,
    abbreviate: format.abbreviate,
    currencyCode: format.currencyCode ?? undefined,
  }

  const handleLoadSample = useCallback(async () => {
    if (!dataset) return
    setSampleLoading(true)
    setSampleError(null)
    try {
      const result = await api.post<{
        columns: string[]
        data: Record<string, unknown>[]
      }>('/api/sql/execute', {
        database_id: dataset.databaseId,
        sql: dataset.sql,
        limit: 50,
      })
      setSampleData(result.data ?? [])
    } catch {
      setSampleError('Could not load preview data.')
    } finally {
      setSampleLoading(false)
    }
  }, [dataset])

  // Show live KPI card when column is selected (steps: column, format, trend, thresholds, or all-done)
  const showLiveKpi = metricColumn !== null

  // No dataset selected
  if (!dataset) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">
          Select a dataset to get started
        </p>
      </div>
    )
  }

  // Step 1: Dataset selected — show column metadata + sample data
  if (step === 'dataset' && !showLiveKpi) {
    return (
      <div className="flex flex-1 flex-col h-full">
        {/* Column metadata */}
        <div className="mb-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Columns
          </h4>
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-1.5 text-left font-medium">Name</th>
                  <th className="px-3 py-1.5 text-left font-medium">Type</th>
                  <th className="px-3 py-1.5 text-left font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {dataset.columns.map((col) => (
                  <tr key={col.name} className="border-b last:border-b-0">
                    <td className="px-3 py-1.5 font-mono">{col.name}</td>
                    <td className="px-3 py-1.5">{col.dataType}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className="text-xs">
                        {col.role}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sample data */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sample Data
            </h4>
            {!sampleData && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleLoadSample}
                disabled={sampleLoading}
              >
                {sampleLoading ? 'Loading...' : 'Load'}
              </Button>
            )}
          </div>

          {sampleError && (
            <p className="text-xs text-destructive">{sampleError}</p>
          )}

          {sampleLoading && (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          )}

          {!sampleData && !sampleLoading && !sampleError && (
            <p className="text-xs text-muted-foreground">
              Click Load to see sample rows
            </p>
          )}

          {sampleData && sampleData.length > 0 && (
            <div className="overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {Object.keys(sampleData[0]).map((col) => (
                      <th
                        key={col}
                        className="px-3 py-1.5 text-left font-medium font-mono"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleData.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 font-mono">
                          {val === null ? 'null' : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Steps 2-5 + all complete: Live KPI value preview
  return (
    <div className="flex flex-col h-full">
      {/* Hero KPI value */}
      <div className="flex flex-1 flex-col items-center justify-center min-h-0 relative">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.04)_0%,transparent_70%)]" />

        {valueLoading ? (
          <Skeleton className="h-12 w-36 rounded" />
        ) : (
          <div className="relative flex flex-col items-center gap-3">
            <Badge variant="outline" className="text-[10px] font-medium tracking-wide">
              {aggregation}
            </Badge>
            <CountAnimation
              number={computedValue}
              duration={0.8}
              formatOptions={formatOptions}
              className={cn(
                'text-5xl font-bold tabular-nums tracking-tighter',
                thresholdColor,
              )}
            />
            <p className="text-sm text-muted-foreground">
              {name || 'Untitled KPI'}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Ready to save banner */}
      {allComplete && (
        <div className="mt-3 shrink-0 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-center">
          <p className="text-sm font-medium">Ready to save</p>
          <p className="text-xs text-muted-foreground">
            Name your KPI above and click Save KPI
          </p>
        </div>
      )}
    </div>
  )
}
