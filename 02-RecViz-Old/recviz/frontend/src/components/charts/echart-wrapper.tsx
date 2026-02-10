import { useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'

import { getEChartsThemeName } from '@/lib/echart-themes'
import { Skeleton } from '@/components/ui/skeleton'
import { useThemeStore } from '@/stores/theme-store'

import { buildEChartOptions } from './chart-config-builder'

import type { ChartWrapperProps } from './ag-chart-wrapper'

export function EChartWrapper({
  config,
  data,
  onNodeClick,
  loading,
  error,
}: ChartWrapperProps) {
  const chartRef = useRef<ReactECharts>(null)
  const theme = useThemeStore((s) => s.theme)

  const isDark = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme === 'dark'
  }, [theme])

  const themeName = getEChartsThemeName(isDark)

  const chartOptions = useMemo(() => {
    return buildEChartOptions(config, data)
  }, [config, data])

  const onEvents = useMemo(() => {
    if (!onNodeClick) return undefined

    return {
      click: (params: {
        name?: string
        value?: unknown
        data?: Record<string, unknown>
        seriesName?: string
      }) => {
        const field = params.seriesName ?? params.name ?? ''
        const value = params.name ?? params.value
        onNodeClick({
          field,
          value: value as string | number,
          data: (params.data as Record<string, unknown>) ?? {},
        })
      },
    }
  }, [onNodeClick])

  if (loading) {
    return <Skeleton className="h-full w-full rounded-lg" />
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <ReactECharts
      ref={chartRef}
      option={chartOptions}
      theme={themeName}
      opts={{ renderer: 'svg' }}
      style={{ width: '100%', height: '100%' }}
      onEvents={onEvents}
      notMerge
    />
  )
}

/** Get the underlying ECharts instance for export operations */
export function getEChartsInstanceFromRef(
  ref: React.RefObject<ReactECharts | null>,
) {
  return ref.current?.getEchartsInstance() ?? null
}
