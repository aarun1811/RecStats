import type { ThresholdConfig, TrendConfig } from '@/types/managed-kpi'

export type ThresholdLevel = 'green' | 'amber' | 'red' | 'none'

export function getThresholdLevel(
  value: number,
  thresholds: ThresholdConfig | null | undefined,
): ThresholdLevel {
  if (!thresholds) return 'none'
  if (value >= thresholds.greenAbove) return 'green'
  if (value >= thresholds.amberAbove) return 'amber'
  return 'red'
}

export const THRESHOLD_STYLES: Record<ThresholdLevel, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  none: 'text-foreground',
}

export const THRESHOLD_BG_STYLES: Record<ThresholdLevel, string> = {
  green: 'bg-green-500/10',
  amber: 'bg-amber-500/10',
  red: 'bg-red-500/10',
  none: '',
}

export function getTrendSubtitle(
  trend: TrendConfig | null | undefined,
): string {
  if (!trend) return ''
  if (trend.mode === 'previous_period') {
    return `vs last ${trend.period}`
  }
  if (trend.mode === 'static_target') {
    return trend.targetLabel || `target: ${trend.targetValue}`
  }
  return ''
}

export function computeAggregation(
  values: number[],
  aggregation: string,
): number {
  if (values.length === 0) return 0
  switch (aggregation) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0)
    case 'AVG':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'COUNT':
      return values.length
    case 'MIN':
      return Math.min(...values)
    case 'MAX':
      return Math.max(...values)
    case 'COUNT_DISTINCT':
      return new Set(values).size
    default:
      return values.reduce((a, b) => a + b, 0)
  }
}
