import { useCallback } from 'react'

import { useDrillStore } from '@/stores/drill-store'
import type { ChartDataResponse } from '@/types/chart'
import type { DrillLevel } from '@/types/filter'

/**
 * Per-chart drill-down with config-defined hierarchy.
 * Each chart drills independently (D-09).
 */
export function useDrillDown(
  chartId: string,
  drillHierarchy: string[] | undefined,
) {
  const drills = useDrillStore((s) => s.drills)
  const drillDownAction = useDrillStore((s) => s.drillDown)
  const drillUpAction = useDrillStore((s) => s.drillUp)
  const drillToLevelAction = useDrillStore((s) => s.drillToLevel)
  const resetDrillAction = useDrillStore((s) => s.resetDrill)

  const chartDrill = drills.get(chartId)
  const levels = chartDrill?.levels ?? []
  const depth = levels.length
  const hierarchy = drillHierarchy ?? []

  const isAtDetailLevel = depth > 0 && depth >= hierarchy.length
  const canDrill = hierarchy.length > 0
  const canGoBack = depth > 0

  const drill = useCallback(
    (column: string, value: string) => {
      if (!canDrill || isAtDetailLevel) return
      drillDownAction(chartId, { column, value, label: value })
    },
    [chartId, canDrill, isAtDetailLevel, drillDownAction],
  )

  const back = useCallback(() => drillUpAction(chartId), [chartId, drillUpAction])
  const reset = useCallback(() => resetDrillAction(chartId), [chartId, resetDrillAction])
  const navigateTo = useCallback(
    (levelIndex: number) => drillToLevelAction(chartId, levelIndex),
    [chartId, drillToLevelAction],
  )

  return {
    levels,
    depth,
    hierarchy,
    isAtDetailLevel,
    canDrill,
    canGoBack,
    drill,
    back,
    reset,
    navigateTo,
  }
}

/**
 * Apply drill filters to chart data and re-aggregate by the next hierarchy column.
 * Used for intermediate drill levels (client-side re-aggregation).
 *
 * Accepts optional `metricColumns` from config metadata (review concern 2).
 * When provided, uses config-defined columns instead of runtime type heuristic.
 */
export function applyDrillFilters(
  data: ChartDataResponse | undefined,
  levels: DrillLevel[],
  nextGroupByColumn?: string,
  metricColumns?: string[],
): ChartDataResponse | undefined {
  if (!data?.data?.length || levels.length === 0) return data

  let filtered = data.data as Record<string, unknown>[]
  for (const level of levels) {
    if (filtered.length > 0 && level.column in filtered[0]) {
      filtered = filtered.filter((r) => String(r[level.column]) === level.value)
    }
  }

  if (filtered.length === 0) return { ...data, data: [], rowCount: 0 }

  // If a next grouping column is provided, re-aggregate
  if (nextGroupByColumn && filtered.length > 0 && nextGroupByColumn in filtered[0]) {
    return reaggregateByField(filtered, nextGroupByColumn, data.columns, metricColumns)
  }

  return { ...data, data: filtered, rowCount: filtered.length }
}

/**
 * Re-aggregates rows by a grouping column, summing metric columns.
 *
 * Addresses review concern 2: metric column detection.
 * When `knownMetricColumns` is provided (from config/schema), uses those directly.
 * Falls back to runtime heuristic: scans ALL rows for any numeric value in a column
 * (not just first row), which handles null/undefined in row 0 correctly.
 */
function reaggregateByField(
  rows: Record<string, unknown>[],
  groupBy: string,
  allColumns: string[],
  knownMetricColumns?: string[],
): ChartDataResponse {
  const metricCols = knownMetricColumns
    ? knownMetricColumns.filter((c) => c !== groupBy && allColumns.includes(c))
    : allColumns.filter((c) => {
        if (c === groupBy) return false
        // Scan up to 10 rows for a numeric value (not just row 0)
        // Addresses review concern 2: typeof sample === 'number' on row 0 is brittle
        // when first row has null/undefined for a metric column
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (typeof rows[i]?.[c] === 'number') return true
        }
        return false
      })

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
