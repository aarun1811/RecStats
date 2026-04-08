import { TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { CountAnimation } from '@/components/shared/count-animation'
import { getThresholdLevel, getTrendSubtitle, THRESHOLD_STYLES } from '@/lib/kpi-utils'
import type { KpiFormatConfig, TrendConfig, ThresholdConfig } from '@/types/managed-kpi'
import type { FormatNumberOptions } from '@/types/formatting'

interface KpiPreviewCardProps {
  name: string
  value: number
  isLoading?: boolean
  format: KpiFormatConfig
  trend?: TrendConfig | null
  trendPercentage?: number | null
  thresholds?: ThresholdConfig | null
  subtitle?: string
  className?: string
}

export function KpiPreviewCard({
  name,
  value,
  isLoading,
  format,
  trend,
  trendPercentage,
  thresholds,
  subtitle,
  className,
}: KpiPreviewCardProps) {
  const thresholdLevel = getThresholdLevel(value, thresholds ?? null)
  const thresholdColor = THRESHOLD_STYLES[thresholdLevel]

  const formatOptions: FormatNumberOptions = {
    type: format.type,
    decimals: format.decimals ?? undefined,
    abbreviate: format.abbreviate,
    currencyCode: format.currencyCode ?? undefined,
  }

  const displaySubtitle = subtitle || getTrendSubtitle(trend ?? null)

  return (
    <div className={cn('rounded-lg border bg-card p-5', className)}>
      {/* KPI Name */}
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
        {name || 'Untitled KPI'}
      </p>

      {/* Value */}
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {isLoading ? (
          <Skeleton className="h-8 w-28 mt-1" />
        ) : (
          <CountAnimation
            number={value}
            duration={0.8}
            formatOptions={formatOptions}
            className={thresholdColor}
          />
        )}
      </div>

      {/* Trend arrow row */}
      {trend && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {trendPercentage !== null && trendPercentage !== undefined ? (
            <>
              {trendPercentage >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  trendPercentage >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {Math.abs(trendPercentage).toFixed(1)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Trend: configured
            </span>
          )}
        </div>
      )}

      {/* Subtitle */}
      {displaySubtitle && (
        <p className="mt-1 text-xs text-muted-foreground">
          {displaySubtitle}
        </p>
      )}
    </div>
  )
}
