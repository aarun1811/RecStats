import { useMemo, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { SankeyChart, RadarChart, SunburstChart, GaugeChart, FunnelChart, GraphChart, ParallelChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { SVGRenderer } from 'echarts/renderers'
import { getEChartsTheme, getChartPalette } from '@/lib/chart-themes'
import { useTheme } from '@/components/layout/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ChartWrapperProps, EChartRef } from '@/types/chart'
import { EXPORT_PIXEL_RATIO } from '@/lib/chart-export'
import { cn } from '@/lib/utils'
import { ColumnMissingError } from './column-missing-error'

// Register required ECharts components (CanvasRenderer + SVGRenderer for export support)
echarts.use([
  SankeyChart,
  RadarChart,
  SunburstChart,
  GaugeChart,
  FunnelChart,
  GraphChart,
  ParallelChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
  SVGRenderer,
])

// Re-register theme whenever resolvedTheme changes (light ↔ dark)
let lastRegisteredTheme = ''
function ensureTheme(resolvedTheme: string) {
  if (lastRegisteredTheme !== resolvedTheme) {
    echarts.registerTheme('recviz', getEChartsTheme())
    lastRegisteredTheme = resolvedTheme
  }
}

/**
 * Config-driven ECharts option builder (D-13).
 * Uses metricColumns and categoryColumn from ChartConfig instead of column order
 * for funnel, gauge, and radar. Sankey, graph, and parallel retain position-based
 * columns (by design — their data sources are shaped specifically for the type).
 */
function buildEChartsOption(
  vizType: string,
  columns: string[],
  data: Record<string, unknown>[],
  metricColumns: string[],
  categoryColumn: string | undefined,
): echarts.EChartsCoreOption {
  const palette = getChartPalette()
  // Config-driven resolution (same pattern as AG Charts)
  const categoryKey = categoryColumn
    ?? columns.find((c) => !metricColumns.includes(c))
    ?? columns[0]
    ?? 'category'
  const metricKey = metricColumns[0] ?? columns.find((c) => c !== categoryKey) ?? columns[1] ?? 'value'

  switch (vizType) {
    case 'sankey': {
      // Sankey: positional columns (source, target, value) by design
      const links = data.map((d) => ({
        source: String(d[columns[0] ?? 'source'] ?? ''),
        target: String(d[columns[1] ?? 'target'] ?? ''),
        value: Number(d[columns[2] ?? 'value'] ?? 0),
      }))
      const nodeSet = new Set<string>()
      links.forEach((l) => {
        nodeSet.add(l.source)
        nodeSet.add(l.target)
      })
      return {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'sankey',
            data: Array.from(nodeSet).map((name) => ({ name })),
            links,
            emphasis: { focus: 'adjacency' },
            lineStyle: { color: 'gradient', curveness: 0.5 },
          },
        ],
      }
    }

    case 'radar': {
      // Config-driven: use resolved metric columns instead of columns.slice(1)
      const radarMetrics = metricColumns.length > 0
        ? metricColumns.filter((c) => columns.includes(c))
        : columns.filter((c) => c !== categoryKey)
      const indicators = data.map((d) => ({
        name: String(d[categoryKey] ?? ''),
        max: Math.max(...radarMetrics.map((c) => Number(d[c] ?? 0))) * 1.2,
      }))
      const series = radarMetrics.map((col, i) => ({
        value: data.map((d) => Number(d[col] ?? 0)),
        name: col,
        areaStyle: { opacity: 0.1 },
        lineStyle: { color: palette.series[i % palette.series.length] },
        itemStyle: { color: palette.series[i % palette.series.length] },
      }))
      return {
        tooltip: {},
        legend: { data: radarMetrics },
        radar: { indicator: indicators },
        series: [{ type: 'radar', data: series }],
      }
    }

    case 'sunburst': {
      return {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'sunburst',
            data: data as unknown[],
            radius: ['15%', '90%'],
            emphasis: { focus: 'ancestor' },
          },
        ],
      }
    }

    case 'gauge': {
      // Config-driven: use resolved metricKey instead of columns[1]
      const value = Number(data[0]?.[metricKey] ?? 0)
      return {
        tooltip: { formatter: '{b}: {c}%' },
        series: [
          {
            type: 'gauge',
            detail: { formatter: '{value}%', fontSize: 20 },
            data: [{ value, name: String(data[0]?.[categoryKey] ?? '') }],
            axisLine: {
              lineStyle: {
                width: 15,
                color: [
                  [0.3, '#ef4444'],
                  [0.7, '#f59e0b'],
                  [1, '#10b981'],
                ],
              },
            },
            pointer: { width: 5 },
          },
        ],
      }
    }

    case 'funnel': {
      // Config-driven: use resolved categoryKey and metricKey
      const funnelData = data.map((d) => ({
        name: String(d[categoryKey] ?? ''),
        value: Number(d[metricKey] ?? 0),
      }))
      return {
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        legend: { data: funnelData.map((d) => d.name) },
        series: [
          {
            type: 'funnel',
            left: '10%',
            top: 10,
            bottom: 10,
            width: '80%',
            sort: 'descending',
            gap: 2,
            label: { show: true, position: 'inside' },
            data: funnelData,
          },
        ],
      }
    }

    case 'graph': {
      // Graph: positional columns (source, target, value) by design
      const nodeSet = new Set<string>()
      const links = data.map((d) => {
        const src = String(d[columns[0] ?? 'source'] ?? '')
        const tgt = String(d[columns[1] ?? 'target'] ?? '')
        nodeSet.add(src)
        nodeSet.add(tgt)
        return { source: src, target: tgt, value: Number(d[columns[2] ?? 'value'] ?? 1) }
      })
      return {
        tooltip: {},
        series: [
          {
            type: 'graph',
            layout: 'force',
            data: Array.from(nodeSet).map((name) => ({ name, symbolSize: 30 })),
            links,
            roam: true,
            force: { repulsion: 200, edgeLength: [50, 200] },
            label: { show: true, fontSize: 10 },
            lineStyle: { curveness: 0.3, opacity: 0.6 },
          },
        ],
      }
    }

    case 'parallel': {
      // Parallel: all columns as dimensions — no change needed
      const dims = columns.map((col, i) => ({ dim: i, name: col }))
      return {
        parallelAxis: dims,
        series: [
          {
            type: 'parallel',
            lineStyle: { width: 1, opacity: 0.3 },
            data: data.map((d) => columns.map((c) => d[c])),
          },
        ],
      }
    }

    default:
      return { series: [] }
  }
}

export const EChartWrapper = forwardRef<EChartRef, ChartWrapperProps>(function EChartWrapper(
  {
    chartId,
    config,
    data,
    isLoading,
    error,
    onChartClick,
    onChartDoubleClick,
    activeSelection,
    className,
  },
  ref,
) {
  const { resolvedTheme } = useTheme()

  // Defer theme registration until after the dark/light CSS class is applied
  const [themeReady, setThemeReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ensureTheme(resolvedTheme)
      setThemeReady((v) => !v) // toggle to force re-render
    })
    return () => cancelAnimationFrame(frame)
  }, [resolvedTheme])

  const chartRef = useRef<ReactEChartsCore>(null)

  useImperativeHandle(ref, () => ({
    getDataURL(opts: { type: 'png' | 'svg'; pixelRatio?: number }) {
      const instance = chartRef.current?.getEchartsInstance()
      if (!instance) return null
      return instance.getDataURL({
        type: opts.type,
        pixelRatio: opts.pixelRatio ?? EXPORT_PIXEL_RATIO,
      })
    },
    getData() {
      if (!data?.columns || !data?.data) return null
      return { columns: data.columns, rows: data.data as Record<string, unknown>[] }
    },
  }), [data])

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

  // Apply highlight/downplay for cross-filter dimming
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return

    if (activeSelection) {
      instance.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      instance.dispatchAction({
        type: 'highlight',
        seriesIndex: 0,
        name: String(activeSelection.value),
      })
    } else {
      instance.dispatchAction({ type: 'downplay', seriesIndex: 0 })
    }
  }, [activeSelection])

  const option = useMemo(() => {
    if (!data?.data?.length) return {}
    return buildEChartsOption(
      config.vizType,
      data.columns,
      data.data,
      config.metricColumns ?? [],
      config.categoryColumn,
    )
  }, [data, config.vizType, config.metricColumns, config.categoryColumn, themeReady])

  // Config-driven category resolution for click handlers
  const resolvedCategoryKey = useMemo(() => {
    if (!data?.columns) return ''
    return config.categoryColumn
      ?? data.columns.find((c) => !(config.metricColumns ?? []).includes(c))
      ?? data.columns[0]
      ?? ''
  }, [data?.columns, config.categoryColumn, config.metricColumns])

  type EChartEventHandler = (...args: unknown[]) => void
  const onEvents = useMemo((): Record<string, EChartEventHandler> | undefined => {
    const events: Record<string, EChartEventHandler> = {}
    if (onChartClick) {
      events.click = (params: { name?: string; value?: unknown; data?: Record<string, unknown> }) => {
        onChartClick({
          chartId,
          column: resolvedCategoryKey,
          value: (params.name ?? params.value ?? '') as string | number,
          row: (params.data ?? {}) as Record<string, unknown>,
        })
      }
    }
    if (onChartDoubleClick) {
      events.dblclick = (params: { name?: string; value?: unknown; data?: Record<string, unknown> }) => {
        onChartDoubleClick({
          chartId,
          column: resolvedCategoryKey,
          value: (params.name ?? params.value ?? '') as string | number,
          row: (params.data ?? {}) as Record<string, unknown>,
        })
      }
    }
    return Object.keys(events).length > 0 ? events : undefined
  }, [onChartClick, onChartDoubleClick, chartId, resolvedCategoryKey])

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
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={option}
        theme="recviz"
        onEvents={onEvents}
        style={{ height: '100%', width: '100%' }}
        notMerge
      />
    </div>
  )
})
