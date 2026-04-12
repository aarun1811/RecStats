import type { DatabaseBackend, ConnectionStatus } from '@/types/database'
import type { ColumnRole, ColumnDataType } from '@/types/managed-dataset'

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
