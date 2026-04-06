import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { CountAnimation } from '@/components/shared/count-animation'
import {
  computeAggregation,
  getThresholdLevel,
  getTrendSubtitle,
  THRESHOLD_STYLES,
} from '@/lib/kpi-utils'
import type { RecvizKpi } from '@/types/managed-kpi'
import type { FormatNumberOptions } from '@/types/formatting'

interface KpiLibraryCardProps {
  kpi: RecvizKpi
  datasetName: string
  datasetDatabaseId: number | undefined
  datasetSql: string | undefined
  onClick: () => void
}

export function KpiLibraryCard({
  kpi,
  datasetName,
  datasetDatabaseId,
  datasetSql,
  onClick,
}: KpiLibraryCardProps) {
  const { data: rawResult, isLoading } = useQuery({
    queryKey: ['kpi-card-value', kpi.id, kpi.datasetId],
    queryFn: () =>
      api.post<{ columns: unknown[]; data: Record<string, unknown>[] }>(
        '/api/sql/execute',
        { database_id: datasetDatabaseId, sql: datasetSql, limit: 10000 },
      ),
    enabled: !!datasetDatabaseId && !!datasetSql,
    staleTime: 5 * 60 * 1000,
  })

  const computedValue = useMemo(() => {
    if (!rawResult?.data?.length) return 0
    const values = rawResult.data
      .map((row) => Number(row[kpi.metricColumn]))
      .filter((v) => !isNaN(v))
    return computeAggregation(values, kpi.aggregation)
  }, [rawResult, kpi.metricColumn, kpi.aggregation])

  const thresholdLevel = getThresholdLevel(computedValue, kpi.config.thresholds)
  const thresholdColor = THRESHOLD_STYLES[thresholdLevel]

  const formatOptions: FormatNumberOptions = {
    type: kpi.config.format.type,
    decimals: kpi.config.format.decimals ?? undefined,
    abbreviate: kpi.config.format.abbreviate,
    currencyCode: kpi.config.format.currencyCode ?? undefined,
  }

  const trendText =
    getTrendSubtitle(kpi.config.trend) || kpi.config.subtitle || ''

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card p-4',
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
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
        {kpi.name}
      </p>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {isLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <CountAnimation
            number={computedValue}
            formatOptions={formatOptions}
            duration={0.8}
            className={thresholdColor}
          />
        )}
      </div>
      {trendText && (
        <p className="mt-1 text-xs text-muted-foreground">{trendText}</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground truncate">
        {datasetName}
      </p>
    </div>
  )
}
