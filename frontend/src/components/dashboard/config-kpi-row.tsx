import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Info, TrendingDown, TrendingUp } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CountAnimation } from '@/components/shared/count-animation'
import { ErrorPanel } from '@/components/shared/error-panel'
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis'
import { useFilterStore } from '@/stores/filter-store'
import { formatValueFull } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api-client'
import type { KpiConfig, KpiResult } from '@/types/dashboard-config'
import type { KpiPartialMatch } from '@/lib/kpi-aggregator'
import type { FormatType, FormatNumberOptions } from '@/types/formatting'

interface ConfigKpiRowProps {
  kpis: KpiConfig[]
  crossFilteredKpis?: KpiResult[] | null
  partialMatches?: KpiPartialMatch[]
}

/**
 * Maps KpiConfig format strings to FormatType.
 * KpiConfig uses 'percent' while FormatType uses 'percentage'.
 */
function toFormatType(format: KpiConfig['format']): FormatType {
  if (format === 'percent') return 'percentage'
  return format
}

function buildFormatOptions(kpi: KpiConfig): FormatNumberOptions {
  const type = toFormatType(kpi.format)
  return {
    type,
    abbreviate: true,
    decimals: type === 'percentage' ? 1 : undefined,
  }
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-6 w-20" />
    </div>
  )
}

export function ConfigKpiRow({
  kpis,
  crossFilteredKpis,
  partialMatches,
}: ConfigKpiRowProps) {
  const appliedFilters = useFilterStore((s) => s.applied)

  // Don't render anything if no KPIs are configured
  if (kpis.length === 0) return null
  const { data, isLoading, isError, error, refetch } = useDashboardKpis(kpis, appliedFilters)

  // Build partial match lookup for quick access
  const partialMatchMap = useMemo(() => {
    const map = new Map<string, string[]>()
    if (partialMatches) {
      for (const pm of partialMatches) {
        map.set(pm.kpiId, pm.missingColumns)
      }
    }
    return map
  }, [partialMatches])

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: kpis.length || 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <ErrorPanel
        message={apiError?.userMessage ?? 'Failed to load KPI data'}
        detail={apiError?.detail}
        onRetry={() => refetch()}
        compact
      />
    )
  }

  // Dual-path: use cross-filtered KPIs when available, otherwise server-computed
  const serverKpis = data?.kpis
  const effectiveKpis = crossFilteredKpis ?? serverKpis

  const kpiResultsMap = new Map(
    effectiveKpis?.map((result) => [result.id, result]) ?? [],
  )

  return (
    <div className="grid grid-cols-4 gap-3">
      {kpis.map((kpi, i) => {
        const result = kpiResultsMap.get(kpi.id)
        const value = result?.value ?? 0
        const percentage = result?.percentage
        const hasTrend = kpi.trend !== undefined && percentage != null
        // 'ratio' display: percentage is a static ratio, not a delta — render
        // neutrally (no border tint, no arrow, no '+' prefix). Default is 'delta'.
        const isRatio = kpi.trend?.display === 'ratio'
        const formatOptions = buildFormatOptions(kpi)
        const fullValueTooltip = formatValueFull(value, formatOptions)
        const missingCols = partialMatchMap.get(kpi.id)

        return (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.05 }}
            className={cn(
              'rounded-lg border border-l-2 bg-card px-4 py-3 flex items-center justify-between gap-3',
              hasTrend && !isRatio && percentage >= 0 && 'border-l-green-500',
              hasTrend && !isRatio && percentage < 0 && 'border-l-red-500',
              (!hasTrend || isRatio) && 'border-l-muted',
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                  {kpi.label}
                </p>
                {missingCols && missingCols.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-3.5 text-muted-foreground shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">
                          Does not include the active{' '}
                          {missingCols
                            .map((c) => `'${c.replace(/_/g, ' ')}'`)
                            .join(', ')}{' '}
                          filter
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div
                className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight"
                title={fullValueTooltip}
              >
                <CountAnimation
                  number={value}
                  formatOptions={formatOptions}
                />
              </div>
            </div>
            {hasTrend && (
              <div
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                  isRatio
                    ? 'bg-muted text-muted-foreground'
                    : percentage >= 0
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400',
                )}
              >
                {!isRatio && (percentage >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                ))}
                {!isRatio && percentage >= 0 ? '+' : ''}
                {percentage.toFixed(1)}%
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
