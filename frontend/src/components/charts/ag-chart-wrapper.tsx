import { useMemo, useRef, useEffect, useState } from 'react'
import { AgCharts } from 'ag-charts-react'
import type { AgChartOptions } from 'ag-charts-enterprise'
import { getAgChartsTheme } from '@/lib/chart-themes'
import { useTheme } from '@/components/layout/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ChartWrapperProps, ChartSelection } from '@/types/chart'
import { cn } from '@/lib/utils'
import { ColumnMissingError } from './column-missing-error'

/** Detect epoch-ms values and convert to short date strings for axis labels. */
function formatDates(rows: Record<string, unknown>[], categoryKey: string): Record<string, unknown>[] {
  if (!rows.length) return rows
  const first = rows[0][categoryKey]
  if (typeof first !== 'number' || first < 1e10) return rows
  return rows.map((r) => ({
    ...r,
    [categoryKey]: new Date(r[categoryKey] as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))
}

/** Returns an itemStyler that dims non-selected items when a selection is active. */
function makeItemStyler(
  categoryKey: string,
  selection: ChartSelection | undefined,
) {
  if (!selection) return undefined
  return (params: { datum: Record<string, unknown>; fillOpacity?: number; strokeWidth?: number }) => {
    const val = params.datum[categoryKey]
    if (val === selection.value) {
      return { fillOpacity: 1, strokeWidth: 2, offset: 8 }
    }
    return { fillOpacity: 0.25, strokeWidth: 0, offset: 0 }
  }
}

/**
 * Config-driven series builder (D-01).
 * Uses metricColumns and categoryColumn from ChartConfig instead of column order.
 * Returns null for unsupported chart types (handled by ChartFactory).
 */
function buildSeries(
  vizType: string,
  columns: string[],
  metricColumns: string[],
  categoryColumn: string | undefined,
  selection?: ChartSelection,
) {
  // Resolve category: explicit config > first non-metric string column > columns[0]
  const categoryKey = categoryColumn
    ?? columns.find((c) => !metricColumns.includes(c))
    ?? columns[0]
    ?? 'category'
  const metricKeys = metricColumns.length > 0
    ? metricColumns.filter((c) => columns.includes(c))
    : columns.filter((c) => c !== categoryKey)
  const styler = makeItemStyler(categoryKey, selection)

  switch (vizType) {
    case 'bar':
    case 'stacked-bar':
      return metricKeys.map((key) => ({
        type: 'bar' as const,
        xKey: categoryKey,
        yKey: key,
        yName: key,
        stacked: vizType === 'stacked-bar',
        cornerRadius: 4,
        ...(styler ? { itemStyler: styler } : {}),
      }))

    case 'line':
      return metricKeys.map((key) => ({
        type: 'line' as const,
        xKey: categoryKey,
        yKey: key,
        yName: key,
        strokeWidth: 2,
        marker: { size: 4 },
      }))

    case 'area':
      return metricKeys.map((key) => ({
        type: 'area' as const,
        xKey: categoryKey,
        yKey: key,
        yName: key,
        strokeWidth: 2,
        fillOpacity: 0.15,
        marker: { size: 4 },
      }))

    case 'pie': {
      const angleKey = metricKeys[0] ?? columns.find((c) => c !== categoryKey) ?? 'count'
      return [
        {
          type: 'pie' as const,
          angleKey,
          calloutLabelKey: categoryKey,
          sectorLabelKey: angleKey,
          ...(styler ? { itemStyler: styler } : {}),
        },
      ]
    }

    case 'donut': {
      const angleKey = metricKeys[0] ?? columns.find((c) => c !== categoryKey) ?? 'count'
      return [
        {
          type: 'donut' as const,
          angleKey,
          calloutLabelKey: categoryKey,
          innerRadiusRatio: 0.6,
          ...(styler ? { itemStyler: styler } : {}),
        },
      ]
    }

    case 'scatter': {
      const xKey = metricColumns[0] ?? columns[0] ?? 'x'
      const yKey = metricColumns[1] ?? columns[1] ?? 'y'
      const sizeKey = metricColumns[2] ?? columns[2]
      return [
        {
          type: 'scatter' as const,
          xKey,
          yKey,
          ...(sizeKey ? { sizeKey } : {}),
        },
      ]
    }

    case 'heatmap': {
      const colorKey = metricKeys[0] ?? columns[2] ?? 'value'
      const xKey = categoryKey
      const nonMetricCols = columns.filter((c) => !metricKeys.includes(c))
      const yKey = nonMetricCols.length > 1
        ? nonMetricCols[1]
        : nonMetricCols[0] !== xKey
          ? nonMetricCols[0]
          : columns[1] ?? 'y'
      return [{ type: 'heatmap' as const, xKey, yKey, colorKey }]
    }

    case 'treemap': {
      const labelKey = categoryKey
      const sizeKey = metricKeys[0] ?? columns[1] ?? 'value'
      const colorKey = metricKeys[1]
      return [{
        type: 'treemap' as const,
        labelKey,
        sizeKey,
        ...(colorKey ? { colorKey, colorRange: ['#43A047', '#FF5722'] } : {}),
      }]
    }

    case 'waterfall':
      return [{
        type: 'waterfall' as const,
        xKey: categoryKey,
        yKey: metricKeys[0] ?? 'value',
        item: { positive: { name: 'Increase' }, negative: { name: 'Decrease' } },
        line: { strokeWidth: 2 },
      }]

    case 'histogram':
      return [
        {
          type: 'bar' as const,
          xKey: categoryKey,
          yKey: metricKeys[0] ?? 'count',
          cornerRadius: 2,
          ...(styler ? { itemStyler: styler } : {}),
        },
      ]

    case 'combo':
      return [
        ...(metricKeys[0]
          ? [{ type: 'bar' as const, xKey: categoryKey, yKey: metricKeys[0], yName: metricKeys[0], cornerRadius: 4, ...(styler ? { itemStyler: styler } : {}) }]
          : []),
        ...(metricKeys[1]
          ? [{ type: 'line' as const, xKey: categoryKey, yKey: metricKeys[1], yName: metricKeys[1], strokeWidth: 2 }]
          : []),
      ]

    default:
      // Unsupported type — return null to signal error (D-05)
      return null
  }
}

export function AgChartWrapper({
  chartId,
  config,
  data,
  isLoading,
  error,
  onChartClick,
  onChartDoubleClick,
  activeSelection,
  className,
}: ChartWrapperProps) {
  const { resolvedTheme } = useTheme()

  // Defer theme read until after the dark/light CSS class is applied to the DOM
  const [theme, setTheme] = useState(() => getAgChartsTheme())
  useEffect(() => {
    const frame = requestAnimationFrame(() => setTheme(getAgChartsTheme()))
    return () => cancelAnimationFrame(frame)
  }, [resolvedTheme])

  // Stable click handler refs to avoid re-creating chart options on every render
  const clickHandlerRef = useRef(onChartClick)
  const dblClickHandlerRef = useRef(onChartDoubleClick)
  useEffect(() => {
    clickHandlerRef.current = onChartClick
    dblClickHandlerRef.current = onChartDoubleClick
  }, [onChartClick, onChartDoubleClick])

  // Debounce single-click to distinguish from double-click
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Column validation (D-09, D-10)
  const missingColumns = useMemo(() => {
    if (!data?.columns) return []
    const missing: string[] = []
    for (const mc of config.metricColumns ?? []) {
      if (!data.columns.includes(mc)) missing.push(mc)
    }
    if (config.categoryColumn && !data.columns.includes(config.categoryColumn)) {
      missing.push(config.categoryColumn)
    }
    return missing
  }, [data?.columns, config.metricColumns, config.categoryColumn])

  const options = useMemo((): AgChartOptions => {
    if (!data?.data?.length) {
      return { data: [], series: [] } as AgChartOptions
    }

    // Config-driven category resolution (D-01)
    const categoryKey = config.categoryColumn
      ?? data.columns.find((c) => !(config.metricColumns ?? []).includes(c))
      ?? data.columns[0]
      ?? 'category'
    const series = buildSeries(
      config.vizType,
      data.columns,
      config.metricColumns ?? [],
      config.categoryColumn,
      activeSelection,
    )
    const rows = formatDates(data.data as Record<string, unknown>[], categoryKey)

    return {
      data: rows,
      series: series ?? [],
      theme: {
        palette: theme.palette,
        overrides: theme.overrides,
      },
      background: { fill: 'transparent' },
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
      listeners: {
        seriesNodeClick: (event: { datum: Record<string, unknown> }) => {
          if (!event.datum) return
          const payload = {
            chartId,
            column: categoryKey,
            value: event.datum[categoryKey] as string | number,
            row: event.datum,
          }
          // Delay single-click so double-click can cancel it
          if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
          clickTimerRef.current = setTimeout(() => {
            clickHandlerRef.current?.(payload)
            clickTimerRef.current = null
          }, 250)
        },
        seriesNodeDoubleClick: (event: { datum: Record<string, unknown> }) => {
          if (!event.datum) return
          // Cancel the pending single-click
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current)
            clickTimerRef.current = null
          }
          dblClickHandlerRef.current?.({
            chartId,
            column: categoryKey,
            value: event.datum[categoryKey] as string | number,
            row: event.datum,
          })
        },
      },
    } as AgChartOptions
  }, [data, config.vizType, config.metricColumns, config.categoryColumn, theme, chartId, activeSelection])

  if (missingColumns.length > 0 && data?.columns) {
    return <ColumnMissingError missing={missingColumns} available={data.columns} />
  }

  if (isLoading) {
    return <Skeleton className={cn('h-[300px] w-full rounded-lg', className)} />
  }

  if (error) {
    return (
      <div className={cn('flex h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground', className)}>
        <AlertTriangle className="size-8 text-destructive" />
        <p className="text-sm">Failed to load chart</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 size-3" />
          Retry
        </Button>
      </div>
    )
  }

  if (!data?.data?.length) {
    return (
      <div className={cn('flex h-[300px] items-center justify-center text-sm text-muted-foreground', className)}>
        No data available
      </div>
    )
  }

  return (
    <div className={cn('h-[300px] w-full', className)}>
      <AgCharts options={options} />
    </div>
  )
}
