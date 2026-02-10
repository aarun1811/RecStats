import { useCallback, useMemo } from 'react'
import { useDrillStore } from '@/stores/drill-store'
import { useChartData } from './use-chart-data'
import type { ChartDataResponse } from '@/types/chart'
import type { DrillLevel } from '@/types/filter'

/**
 * Dashboard-level drill-down. All charts read the same drill state.
 *
 *   Level 0: Overview (default aggregated view)
 *   Level 1: Click month/value → re-aggregate by next dimension (client-side)
 *   Level 2: Click day/sub-value → breakdown by category/desk (client-side)
 *   Level 3: Click category → detail mode — charts hide, grid shows records
 */

/** Apply drill filters to chart data client-side.
 *  Only applies filters for columns that actually exist in the chart's data.
 *  Charts that don't have the drilled column are left unfiltered (they show
 *  their normal view, which is the correct behavior for aggregated charts).
 */
export function applyDrillFilters(
  data: ChartDataResponse | undefined,
  drillLevels: DrillLevel[],
): ChartDataResponse | undefined {
  if (!data?.data?.length || drillLevels.length === 0) return data

  // Only apply drill levels whose column exists in this chart's data
  const applicableLevels = drillLevels.filter((level) =>
    data.columns.includes(level.column) ||
    (data.data.length > 0 && level.column in (data.data[0] as Record<string, unknown>)),
  )

  if (applicableLevels.length === 0) return data

  let filtered = data.data as Record<string, unknown>[]

  for (const level of applicableLevels) {
    filtered = filtered.filter((r) => {
      const val = r[level.column]
      return String(val) === level.value
    })
  }

  if (filtered.length === 0) return { ...data, data: [], rowCount: 0 }

  // Re-aggregate: find dimensions that weren't drilled on
  const drilledCols = new Set(applicableLevels.map((l) => l.column))
  const remainingDims = data.columns.filter(
    (c) => !drilledCols.has(c) && !isMetricColumn(c),
  )
  const metricCols = data.columns.filter((c) => isMetricColumn(c))

  if (remainingDims.length > 0 && metricCols.length > 0) {
    // Re-aggregate by the first remaining dimension
    const groupBy = remainingDims[0]
    return reaggregateByField(filtered, groupBy, metricCols)
  }

  return { ...data, data: filtered, rowCount: filtered.length }
}

/** Check if current drill depth means we should show detail grid instead of charts. */
export function isDrillDetailMode(depth: number): boolean {
  return depth >= 3
}

/** Build row filter function for the drill context (used by DataGrid). */
export function drillRowFilter(
  drillLevels: DrillLevel[],
): (row: Record<string, unknown>) => boolean {
  if (drillLevels.length === 0) return () => true
  return (row) => {
    for (const level of drillLevels) {
      const val = row[level.column]
      if (String(val) !== level.value) return false
    }
    return true
  }
}

export function useDrillDown(chartId: string) {
  const sourceChartId = useDrillStore((s) => s.sourceChartId)
  const levels = useDrillStore((s) => s.levels)
  const drillDownAction = useDrillStore((s) => s.drillDown)
  const drillUpAction = useDrillStore((s) => s.drillUp)
  const drillToLevelAction = useDrillStore((s) => s.drillToLevel)
  const resetDrillAction = useDrillStore((s) => s.resetDrill)

  const depth = levels.length

  // Fetch base chart data
  const { data: baseData, isLoading } = useChartData(chartId)

  // Apply drill filters to this chart's data
  const drilledData = useMemo(
    () => applyDrillFilters(baseData, levels),
    [baseData, levels],
  )

  const drill = useCallback(
    (column: string, value: string) => {
      drillDownAction(chartId, { level: depth + 1, column, value })
    },
    [chartId, depth, drillDownAction],
  )

  const back = useCallback(() => drillUpAction(), [drillUpAction])
  const reset = useCallback(() => resetDrillAction(), [resetDrillAction])
  const navigateTo = useCallback(
    (level: number) => drillToLevelAction(level),
    [drillToLevelAction],
  )

  return {
    sourceChartId,
    levels,
    depth,
    data: drilledData,
    isLoading,
    isDetailMode: isDrillDetailMode(depth),
    drill,
    back,
    reset,
    navigateTo,
    canGoBack: depth > 0,
  }
}

/** Re-aggregate rows by a grouping field, summing numeric columns. */
function reaggregateByField(
  rows: Record<string, unknown>[],
  groupBy: string,
  metricCols: string[],
): ChartDataResponse {
  const groups = new Map<string, Record<string, unknown>>()

  for (const row of rows) {
    const key = String(row[groupBy] ?? 'Unknown')
    if (!groups.has(key)) {
      groups.set(key, { [groupBy]: row[groupBy] })
    }
    const group = groups.get(key)!
    for (const col of metricCols) {
      const val = row[col]
      if (typeof val === 'number') {
        group[col] = ((group[col] as number) ?? 0) + val
      }
    }
  }

  const data = Array.from(groups.values())
  return {
    chartId: '',
    columns: [groupBy, ...metricCols],
    data,
    rowCount: data.length,
  }
}

/** Heuristic: is this a metric/measure column? */
function isMetricColumn(col: string): boolean {
  const lower = col.toLowerCase()
  return (
    lower === 'count' ||
    lower.includes('count') ||
    lower.includes('sum') ||
    lower.includes('avg') ||
    lower.includes('total') ||
    lower.includes('amount') ||
    lower.includes('rate')
  )
}
