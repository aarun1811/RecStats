import type { DatabaseBackend, ConnectionStatus } from '@/types/database'
import type { ColumnRole, ColumnDataType } from '@/types/managed-dataset'
import type { LibraryChartType } from '@/types/managed-chart'
import type { AggregationType } from '@/types/managed-kpi'

// --- Backend (database engine) display constants ---

export const BACKEND_LABELS: Record<DatabaseBackend, string> = {
  oracle: 'Oracle',
}

export const BACKEND_COLORS: Record<DatabaseBackend, string> = {
  oracle: 'text-red-600 dark:text-red-400',
}

export const BACKEND_BORDER_COLORS: Record<DatabaseBackend, string> = {
  oracle: 'border-l-red-500',
}

// --- Connection status display constants ---

export const STATUS_STYLES: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  unreachable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  untested: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  unreachable: 'Unreachable',
  untested: 'Untested',
}

export const STATUS_BORDER_COLORS: Record<ConnectionStatus, string> = {
  connected: 'border-l-emerald-500',
  unreachable: 'border-l-red-500',
  untested: 'border-l-amber-500',
}

// --- Column role display constants ---

export const COLUMN_ROLE_STYLES: Record<ColumnRole, string> = {
  dimension: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  measure: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  time: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  none: 'bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400',
}

export const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  dimension: 'Dimension',
  measure: 'Measure',
  time: 'Time',
  none: 'None',
}

export const COLUMN_ROLE_SHORT_LABELS: Record<ColumnRole, { singular: string; plural: string }> = {
  dimension: { singular: 'dim', plural: 'dims' },
  measure: { singular: 'meas', plural: 'meas' },
  time: { singular: 'time', plural: 'time' },
  none: { singular: 'none', plural: 'none' },
}

// --- Column data type display constants ---

export const COLUMN_TYPE_STYLES: Record<ColumnDataType, string> = {
  string: 'bg-slate-100 dark:bg-slate-800/30 text-slate-700 dark:text-slate-400',
  number: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  date: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  currency: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
}

export const COLUMN_TYPE_LABELS: Record<ColumnDataType, string> = {
  string: 'String',
  number: 'Number',
  date: 'Date',
  currency: 'Currency',
}

// --- Chart type accent display constants ---

export const CHART_TYPE_BORDER_COLORS: Record<LibraryChartType, string> = {
  'bar': 'border-l-blue-500',
  'stacked-bar': 'border-l-blue-500',
  'line': 'border-l-sky-500',
  'area': 'border-l-cyan-500',
  'pie': 'border-l-violet-500',
  'donut': 'border-l-violet-500',
  'scatter': 'border-l-indigo-500',
  'heatmap': 'border-l-orange-500',
  'treemap': 'border-l-emerald-500',
  'waterfall': 'border-l-teal-500',
  'bullet': 'border-l-slate-500',
  'box-plot': 'border-l-zinc-500',
  'combo': 'border-l-rose-500',
  'sankey': 'border-l-amber-500',
  'sunburst': 'border-l-yellow-500',
  'radar': 'border-l-lime-500',
  'gauge': 'border-l-red-500',
  'funnel': 'border-l-fuchsia-500',
  'graph': 'border-l-pink-500',
  'parallel': 'border-l-purple-500',
}

export const CHART_TYPE_PILL_BG: Record<LibraryChartType, string> = {
  'bar': 'bg-blue-500/15',
  'stacked-bar': 'bg-blue-500/15',
  'line': 'bg-sky-500/15',
  'area': 'bg-cyan-500/15',
  'pie': 'bg-violet-500/15',
  'donut': 'bg-violet-500/15',
  'scatter': 'bg-indigo-500/15',
  'heatmap': 'bg-orange-500/15',
  'treemap': 'bg-emerald-500/15',
  'waterfall': 'bg-teal-500/15',
  'bullet': 'bg-slate-500/15',
  'box-plot': 'bg-zinc-500/15',
  'combo': 'bg-rose-500/15',
  'sankey': 'bg-amber-500/15',
  'sunburst': 'bg-yellow-500/15',
  'radar': 'bg-lime-500/15',
  'gauge': 'bg-red-500/15',
  'funnel': 'bg-fuchsia-500/15',
  'graph': 'bg-pink-500/15',
  'parallel': 'bg-purple-500/15',
}

export const CHART_TYPE_PILL_TEXT: Record<LibraryChartType, string> = {
  'bar': 'text-blue-600 dark:text-blue-400',
  'stacked-bar': 'text-blue-600 dark:text-blue-400',
  'line': 'text-sky-600 dark:text-sky-400',
  'area': 'text-cyan-600 dark:text-cyan-400',
  'pie': 'text-violet-600 dark:text-violet-400',
  'donut': 'text-violet-600 dark:text-violet-400',
  'scatter': 'text-indigo-600 dark:text-indigo-400',
  'heatmap': 'text-orange-600 dark:text-orange-400',
  'treemap': 'text-emerald-600 dark:text-emerald-400',
  'waterfall': 'text-teal-600 dark:text-teal-400',
  'bullet': 'text-slate-600 dark:text-slate-400',
  'box-plot': 'text-zinc-600 dark:text-zinc-400',
  'combo': 'text-rose-600 dark:text-rose-400',
  'sankey': 'text-amber-600 dark:text-amber-400',
  'sunburst': 'text-yellow-600 dark:text-yellow-400',
  'radar': 'text-lime-600 dark:text-lime-400',
  'gauge': 'text-red-600 dark:text-red-400',
  'funnel': 'text-fuchsia-600 dark:text-fuchsia-400',
  'graph': 'text-pink-600 dark:text-pink-400',
  'parallel': 'text-purple-600 dark:text-purple-400',
}

// --- KPI aggregation type accent display constants ---

export const KPI_AGG_BORDER_COLORS: Record<AggregationType, string> = {
  SUM: 'border-l-emerald-500',
  AVG: 'border-l-blue-500',
  COUNT: 'border-l-violet-500',
  MIN: 'border-l-amber-500',
  MAX: 'border-l-amber-500',
  COUNT_DISTINCT: 'border-l-teal-500',
}

export const KPI_AGG_PILL_BG: Record<AggregationType, string> = {
  SUM: 'bg-emerald-500/15',
  AVG: 'bg-blue-500/15',
  COUNT: 'bg-violet-500/15',
  MIN: 'bg-amber-500/15',
  MAX: 'bg-amber-500/15',
  COUNT_DISTINCT: 'bg-teal-500/15',
}

export const KPI_AGG_PILL_TEXT: Record<AggregationType, string> = {
  SUM: 'text-emerald-600 dark:text-emerald-400',
  AVG: 'text-blue-600 dark:text-blue-400',
  COUNT: 'text-violet-600 dark:text-violet-400',
  MIN: 'text-amber-600 dark:text-amber-400',
  MAX: 'text-amber-600 dark:text-amber-400',
  COUNT_DISTINCT: 'text-teal-600 dark:text-teal-400',
}

// --- KPI threshold border display constants ---

export const THRESHOLD_BORDER_COLORS: Record<string, string> = {
  green: 'border-l-green-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  none: 'border-l-muted',
}
