import { useMemo, useEffect, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { SankeyChart, RadarChart, SunburstChart, GaugeChart, FunnelChart, GraphChart, ParallelChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getEChartsTheme, getChartPalette } from '@/lib/chart-themes'
import { useTheme } from '@/components/layout/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ChartWrapperProps } from '@/types/chart'
import { cn } from '@/lib/utils'

// Register required ECharts components
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
])

// Re-register theme whenever resolvedTheme changes (light ↔ dark)
let lastRegisteredTheme = ''
function ensureTheme(resolvedTheme: string) {
  if (lastRegisteredTheme !== resolvedTheme) {
    echarts.registerTheme('recviz', getEChartsTheme())
    lastRegisteredTheme = resolvedTheme
  }
}

function buildEChartsOption(
  vizType: string,
  columns: string[],
  data: Record<string, unknown>[],
): echarts.EChartsCoreOption {
  const palette = getChartPalette()
  const categoryKey = columns[0] ?? 'category'
  const metricKey = columns[1] ?? 'value'

  switch (vizType) {
    case 'sankey': {
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
      const indicators = data.map((d) => ({
        name: String(d[categoryKey] ?? ''),
        max: Math.max(...columns.slice(1).map((c) => Number(d[c] ?? 0))) * 1.2,
      }))
      const series = columns.slice(1).map((col, i) => ({
        value: data.map((d) => Number(d[col] ?? 0)),
        name: col,
        areaStyle: { opacity: 0.1 },
        lineStyle: { color: palette.series[i % palette.series.length] },
        itemStyle: { color: palette.series[i % palette.series.length] },
      }))
      return {
        tooltip: {},
        legend: { data: columns.slice(1) },
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

export function EChartWrapper({
  chartId,
  config,
  data,
  isLoading,
  error,
  onChartClick,
  className,
}: ChartWrapperProps) {
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

  const option = useMemo(() => {
    if (!data?.data?.length) return {}
    return buildEChartsOption(config.vizType, data.columns, data.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, config.vizType, themeReady])

  const onEvents = useMemo((): Record<string, Function> | undefined => {
    if (!onChartClick) return undefined
    return {
      click: (params: { name?: string; value?: unknown; data?: Record<string, unknown> }) => {
        onChartClick({
          chartId,
          column: data?.columns[0] ?? '',
          value: (params.name ?? params.value ?? '') as string | number,
          row: (params.data ?? {}) as Record<string, unknown>,
        })
      },
    }
  }, [onChartClick, chartId, data?.columns])

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
        echarts={echarts}
        option={option}
        theme="recviz"
        onEvents={onEvents}
        style={{ height: '100%', width: '100%' }}
        notMerge
      />
    </div>
  )
}
