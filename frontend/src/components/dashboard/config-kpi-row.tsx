import { TrendingDown, TrendingUp } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { CountAnimation } from '@/components/shared/count-animation'
import { ErrorPanel } from '@/components/shared/error-panel'
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis'
import { useFilterStore } from '@/stores/filter-store'
import { formatValueFull } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api-client'
import type { KpiConfig } from '@/types/dashboard-config'
import type { FormatType, FormatNumberOptions } from '@/types/formatting'

interface ConfigKpiRowProps {
  dashboardId: string
  kpis: KpiConfig[]
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

export function ConfigKpiRow({ dashboardId, kpis }: ConfigKpiRowProps) {
  const appliedFilters = useFilterStore((s) => s.applied)
  const { data, isLoading, isError, error, refetch } = useDashboardKpis(dashboardId, appliedFilters)

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

  const kpiResultsMap = new Map(
    data?.kpis.map((result) => [result.id, result]),
  )

  return (
    <div className="grid grid-cols-4 gap-3">
      {kpis.map((kpi) => {
        const result = kpiResultsMap.get(kpi.id)
        const value = result?.value ?? 0
        const percentage = result?.percentage
        const hasTrend = kpi.trend !== undefined && percentage != null
        const formatOptions = buildFormatOptions(kpi)
        const fullValueTooltip = formatValueFull(value, formatOptions)

        return (
          <div
            key={kpi.id}
            className="rounded-lg border bg-card px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                {kpi.label}
              </p>
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
                  percentage >= 0
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400',
                )}
              >
                {percentage >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {percentage >= 0 ? '+' : ''}
                {percentage.toFixed(1)}%
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
