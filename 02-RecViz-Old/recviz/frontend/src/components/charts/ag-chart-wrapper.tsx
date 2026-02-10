import { useCallback, useMemo, useRef } from 'react'
import { AgCharts } from 'ag-charts-react'
import type { AgChartOptions, AgChartInstance } from 'ag-charts-community'

import { getChartTheme } from '@/lib/ag-chart-themes'
import { Skeleton } from '@/components/ui/skeleton'
import { useThemeStore } from '@/stores/theme-store'
import type { ChartClickEvent, ChartConfig } from '@/types/chart'
import type { CrossFilter } from '@/types/filter'

import { buildAgChartOptions } from './chart-config-builder'

export interface ChartWrapperProps {
  config: ChartConfig
  data: Record<string, unknown>[]
  crossFilter?: CrossFilter
  onNodeClick?: (event: ChartClickEvent) => void
  loading?: boolean
  error?: string
}

export function AgChartWrapper({
  config,
  data,
  crossFilter,
  onNodeClick,
  loading,
  error,
}: ChartWrapperProps) {
  const chartRef = useRef<AgChartInstance>(null)
  const theme = useThemeStore((s) => s.theme)

  const isDark = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme === 'dark'
  }, [theme])

  const handleNodeClick = useCallback(
    (params: { datum?: Record<string, unknown>; xKey?: string; yKey?: string }) => {
      if (!onNodeClick || !params.datum) return
      const field = params.xKey ?? params.yKey ?? ''
      const value = params.datum[field]
      onNodeClick({
        field,
        value: value as string | number,
        data: params.datum,
      })
    },
    [onNodeClick],
  )

  const chartOptions = useMemo((): AgChartOptions => {
    const baseOptions = buildAgChartOptions(config, data)
    const chartTheme = getChartTheme(isDark)

    // Build options with theme applied.
    // Cross-filter highlighting and click listeners are configured
    // via the theme's highlight style and chart-level listeners.
    const options: AgChartOptions = {
      ...baseOptions,
      theme: chartTheme,
    }

    // Apply cross-filter highlight style via series-level config
    if (crossFilter && options.series) {
      for (const series of options.series) {
        Object.assign(series, {
          highlightStyle: {
            item: { fillOpacity: 1 },
            series: { dimOpacity: 0.2 },
          },
        })
      }
    }

    // Attach click listeners at chart level
    if (onNodeClick) {
      Object.assign(options, {
        listeners: {
          seriesNodeClick: handleNodeClick,
        },
      })
    }

    return options
  }, [config, data, isDark, crossFilter, onNodeClick, handleNodeClick])

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
    <div className="h-full w-full">
      <AgCharts ref={chartRef} options={chartOptions} />
    </div>
  )
}
