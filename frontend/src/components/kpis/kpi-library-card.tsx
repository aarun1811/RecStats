import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Gauge } from 'lucide-react'

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
  datasetDatabaseId: string | undefined
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

  const timeAgo = formatDistanceToNow(new Date(kpi.updatedAt), { addSuffix: true })

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
      {/* Hero area — KPI value display */}
      <div className="relative h-[100px] flex flex-col items-center justify-center gap-1">
        {isLoading ? (
          <Skeleton className="h-8 w-28 rounded" />
        ) : (
          <>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {kpi.aggregation}
            </p>
            <CountAnimation
              number={computedValue}
              formatOptions={formatOptions}
              duration={0.8}
              className={cn('text-2xl font-bold tabular-nums tracking-tight', thresholdColor)}
            />
            {trendText && (
              <p className="text-[11px] text-muted-foreground">{trendText}</p>
            )}
          </>
        )}

        {/* KPI type pill — top right */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm border border-border/50">
          <Gauge size={10} />
          KPI
        </div>
      </div>

      {/* Metadata strip — matches chart card */}
      <div className="flex flex-col gap-0.5 px-3.5 py-3">
        <p className="text-sm font-semibold truncate leading-snug">{kpi.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {datasetName}
          <span className="mx-1.5 opacity-40">&middot;</span>
          {timeAgo}
        </p>
      </div>
    </div>
  )
}
