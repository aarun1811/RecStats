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
      return { fillOpacity: 1, strokeWidth: 2 }
    }
    return { fillOpacity: 0.25, strokeWidth: 0 }
  }
}

function buildSeries(vizType: string, columns: string[], selection?: ChartSelection) {
  const categoryKey = columns[0] ?? 'category'
  const metricKeys = columns.slice(1)
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

    case 'pie':
      return [
        {
          type: 'pie' as const,
          angleKey: metricKeys[0] ?? 'count',
          calloutLabelKey: categoryKey,
          sectorLabelKey: metricKeys[0] ?? 'count',
          ...(styler ? { itemStyler: styler } : {}),
        },
      ]

    case 'donut':
      return [
        {
          type: 'donut' as const,
          angleKey: metricKeys[0] ?? 'count',
          calloutLabelKey: categoryKey,
          innerRadiusRatio: 0.6,
          ...(styler ? { itemStyler: styler } : {}),
        },
      ]

    case 'scatter':
      return [
        {
          type: 'scatter' as const,
          xKey: columns[0] ?? 'x',
          yKey: columns[1] ?? 'y',
          ...(columns[2] ? { sizeKey: columns[2] } : {}),
        },
      ]

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

    case 'waterfall':
      return [
        {
          type: 'bar' as const,
          xKey: categoryKey,
          yKey: metricKeys[0] ?? 'value',
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
      return metricKeys.map((key) => ({
        type: 'bar' as const,
        xKey: categoryKey,
        yKey: key,
        yName: key,
        cornerRadius: 4,
        ...(styler ? { itemStyler: styler } : {}),
      }))
  }
}

export function AgChartWrapper({
  chartId,
  config,
  data,
  isLoading,
  error,
  onChartClick,
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

  // Stable click handler ref to avoid re-creating chart options on every render
  const clickHandlerRef = useRef(onChartClick)
  clickHandlerRef.current = onChartClick

  const options = useMemo((): AgChartOptions => {
    if (!data?.data?.length) {
      return { data: [], series: [] } as AgChartOptions
    }

    const categoryKey = data.columns[0] ?? 'category'
    const series = buildSeries(config.vizType, data.columns, activeSelection)
    const rows = formatDates(data.data as Record<string, unknown>[], categoryKey)

    return {
      data: rows,
      series,
      theme: {
        palette: theme.palette,
        overrides: theme.overrides,
      },
      background: { fill: 'transparent' },
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
      listeners: {
        seriesNodeClick: (event: { datum: Record<string, unknown> }) => {
          if (!clickHandlerRef.current || !event.datum) return
          clickHandlerRef.current({
            chartId,
            column: categoryKey,
            value: event.datum[categoryKey] as string | number,
            row: event.datum,
          })
        },
      },
    } as AgChartOptions
  }, [data, config.vizType, theme, chartId, activeSelection])

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
