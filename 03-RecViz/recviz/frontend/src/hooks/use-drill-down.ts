import { useCallback, useMemo } from 'react'
import { useDrillStore } from '@/stores/drill-store'
import { useChartData } from './use-chart-data'
import type { ChartDataResponse } from '@/types/chart'

/**
 * 4-level drill-down:
 *   Level 0: Overview (default aggregated view)
 *   Level 1: Click month → re-aggregate by day (client-side)
 *   Level 2: Click day → breakdown by category/desk (client-side)
 *   Level 3: Click category → show individual records (backend call)
 */
export function useDrillDown(chartId: string) {
  const drillState = useDrillStore((s) => s.drillState[chartId])
  const drillDownAction = useDrillStore((s) => s.drillDown)
  const drillUpAction = useDrillStore((s) => s.drillUp)
  const drillToLevelAction = useDrillStore((s) => s.drillToLevel)
  const resetDrillAction = useDrillStore((s) => s.resetDrill)

  const levels = drillState?.levels ?? []
  const depth = levels.length

  // Always fetch the base chart data (level 0)
  const { data: baseData, isLoading: baseLoading } = useChartData(chartId)

  // Compute drill-specific data client-side for levels 1-2
  const drilledData = useMemo((): ChartDataResponse | undefined => {
    if (!baseData?.data?.length) return baseData
    if (depth === 0) return baseData

    const rows = baseData.data as Record<string, unknown>[]

    if (depth === 1) {
      // Level 1: filter to selected month, re-aggregate by day
      const monthFilter = levels[0]
      const filtered = rows.filter((r) => {
        const val = r[monthFilter.column]
        return String(val) === monthFilter.value
      })

      // If the data has date-like columns, group by day
      const dateCol = baseData.columns.find((c) =>
        c.toLowerCase().includes('date') || c.toLowerCase().includes('created'),
      )
      if (dateCol) {
        return reaggregateByField(filtered, dateCol, baseData.columns)
      }

      // For non-date charts, just group by next-level dimension
      const nextDim = findNextDimension(baseData.columns, monthFilter.column)
      if (nextDim) {
        return reaggregateByField(filtered, nextDim, baseData.columns)
      }
      return { ...baseData, data: filtered, rowCount: filtered.length }
    }

    if (depth === 2) {
      // Level 2: filter by both level 0 and level 1, group by next dimension
      let filtered = rows
      for (const level of levels) {
        filtered = filtered.filter((r) => String(r[level.column]) === level.value)
      }

      // Group by a new dimension (category, desk, break_type, etc.)
      const usedCols = new Set(levels.map((l) => l.column))
      const breakdownCol = baseData.columns.find(
        (c) => !usedCols.has(c) && !isMetricColumn(c),
      )
      if (breakdownCol) {
        return reaggregateByField(filtered, breakdownCol, baseData.columns)
      }
      return { ...baseData, data: filtered, rowCount: filtered.length }
    }

    // Level 3+: return filtered raw rows (backend call would be ideal, but
    // for now we filter client-side from cached data)
    let filtered = rows
    for (const level of levels) {
      filtered = filtered.filter((r) => String(r[level.column]) === level.value)
    }
    return { ...baseData, data: filtered, rowCount: filtered.length }
  }, [baseData, levels, depth])

  const drill = useCallback(
    (column: string, value: string) => {
      drillDownAction(chartId, { level: depth + 1, column, value })
    },
    [chartId, depth, drillDownAction],
  )

  const back = useCallback(() => drillUpAction(chartId), [chartId, drillUpAction])
  const reset = useCallback(() => resetDrillAction(chartId), [chartId, resetDrillAction])
  const navigateTo = useCallback(
    (level: number) => drillToLevelAction(chartId, level),
    [chartId, drillToLevelAction],
  )

  return {
    levels,
    depth,
    data: drilledData,
    isLoading: baseLoading,
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
  allColumns: string[],
): ChartDataResponse {
  const groups = new Map<string, Record<string, unknown>>()

  for (const row of rows) {
    const key = String(row[groupBy] ?? 'Unknown')
    if (!groups.has(key)) {
      groups.set(key, { [groupBy]: row[groupBy] })
    }
    const group = groups.get(key)!
    for (const col of allColumns) {
      if (col === groupBy) continue
      const val = row[col]
      if (typeof val === 'number') {
        group[col] = ((group[col] as number) ?? 0) + val
      }
    }
  }

  const data = Array.from(groups.values())
  return {
    chartId: '',
    columns: [groupBy, ...allColumns.filter((c) => c !== groupBy && isMetricColumn(c))],
    data,
    rowCount: data.length,
  }
}

/** Find the next dimension column to drill into (skip already-used ones). */
function findNextDimension(columns: string[], usedColumn: string): string | undefined {
  return columns.find((c) => c !== usedColumn && !isMetricColumn(c))
}

/** Heuristic: columns with numeric-ish names or that are metric columns. */
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
