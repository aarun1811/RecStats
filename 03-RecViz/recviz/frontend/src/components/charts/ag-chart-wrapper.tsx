import { useMemo, useRef, useEffect } from 'react'
import { AgCharts } from 'ag-charts-react'
import type { AgChartOptions } from 'ag-charts-enterprise'
import { getAgChartsTheme } from '@/lib/chart-themes'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ChartWrapperProps } from '@/types/chart'
import { cn } from '@/lib/utils'

function buildSeries(vizType: string, columns: string[]) {
  const categoryKey = columns[0] ?? 'category'
  const metricKeys = columns.slice(1)

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
        },
      ]

    case 'donut':
      return [
        {
          type: 'donut' as const,
          angleKey: metricKeys[0] ?? 'count',
          calloutLabelKey: categoryKey,
          innerRadiusRatio: 0.6,
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
        },
      ]

    case 'waterfall':
      return [
        {
          type: 'bar' as const,
          xKey: categoryKey,
          yKey: metricKeys[0] ?? 'value',
        },
      ]

    case 'combo':
      return [
        ...(metricKeys[0]
          ? [{ type: 'bar' as const, xKey: categoryKey, yKey: metricKeys[0], yName: metricKeys[0], cornerRadius: 4 }]
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
  className,
}: ChartWrapperProps) {
  const chartRef = useRef<{ chart?: { addEventListener?: (type: string, cb: (e: unknown) => void) => void } }>(null)
  const theme = useMemo(() => getAgChartsTheme(), [])

  // Wire cross-filter click via chart ref
  useEffect(() => {
    if (!onChartClick || !chartRef.current?.chart?.addEventListener) return
    const handler = (e: unknown) => {
      const event = e as { datum?: Record<string, unknown> }
      if (!event.datum) return
      const col = data?.columns[0] ?? ''
      onChartClick({
        chartId,
        column: col,
        value: event.datum[col] as string | number,
        row: event.datum,
      })
    }
    chartRef.current.chart.addEventListener('nodeClick', handler)
  }, [onChartClick, chartId, data?.columns])

  const options = useMemo((): AgChartOptions => {
    if (!data?.data?.length) {
      return { data: [], series: [] } as AgChartOptions
    }

    const series = buildSeries(config.vizType, data.columns)

    return {
      data: data.data as Record<string, unknown>[],
      series,
      theme: {
        palette: theme.palette,
        overrides: theme.overrides,
      },
      background: { fill: 'transparent' },
      padding: { top: 10, right: 10, bottom: 10, left: 10 },
    } as AgChartOptions
  }, [data, config.vizType, theme])

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
      <AgCharts ref={chartRef as React.Ref<never>} options={options} />
    </div>
  )
}
