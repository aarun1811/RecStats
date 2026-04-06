import type { FormatType } from '@/types/formatting'

export type AggregationType = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'COUNT_DISTINCT'

export interface KpiFormatConfig {
  type: FormatType
  decimals: number | null
  abbreviate: boolean
  currencyCode: string | null
}

export interface TrendPeriodConfig {
  mode: 'previous_period'
  period: 'day' | 'week' | 'month'
}

export interface TrendTargetConfig {
  mode: 'static_target'
  targetValue: number
  targetLabel: string
}

export type TrendConfig = TrendPeriodConfig | TrendTargetConfig

export interface ThresholdConfig {
  greenAbove: number
  amberAbove: number
}

export interface KpiLibraryConfig {
  format: KpiFormatConfig
  trend: TrendConfig | null
  thresholds: ThresholdConfig | null
  subtitle: string
}

export interface RecvizKpi {
  id: string
  name: string
  description: string
  datasetId: string
  metricColumn: string
  aggregation: AggregationType
  config: KpiLibraryConfig
  createdAt: string
  updatedAt: string
}

export interface KpiCreate {
  name: string
  description: string
  datasetId: string
  metricColumn: string
  aggregation: AggregationType
  config: KpiLibraryConfig
}

export interface KpiUpdate {
  name?: string
  description?: string
  metricColumn?: string
  aggregation?: AggregationType
  config?: KpiLibraryConfig
}

export interface KpiDeleteCheck {
  canDelete: boolean
  referencingDashboards: { id: string; name: string }[]
}
