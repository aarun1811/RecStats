import { forwardRef, useImperativeHandle, useRef } from 'react'
import { toast } from 'sonner'

import type { ChartWrapperProps, ChartRef, AgChartRef, EChartRef } from '@/types/chart'
import {
  triggerDownloadFromDataURL,
  downloadCSV,
  copyToClipboard as copyDataToClipboard,
  EXPORT_PIXEL_RATIO,
} from '@/lib/chart-export'
import { AgChartWrapper } from './ag-chart-wrapper'
import { EChartWrapper } from './echart-wrapper'
import { UnsupportedChartError } from './unsupported-chart-error'

/** Chart types handled by ECharts (exotic / specialized). */
const ECHART_TYPES = new Set([
  'sankey',
  'radar',
  'sunburst',
  'gauge',
  'funnel',
  'graph',
  'parallel',
])

/** Chart types handled by AG Charts (standard). */
const SUPPORTED_AG_TYPES = new Set([
  'bar',
  'stacked-bar',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'heatmap',
  'treemap',
  'waterfall',
  'combo',
  'histogram',
  'bullet',
  'box-plot',
])

/**
 * Routes to the correct chart wrapper based on viz type.
 * AG Charts handles standard types (bar, line, area, pie, donut, scatter, etc.).
 * ECharts handles exotic types (sankey, radar, sunburst, gauge, funnel, graph, parallel).
 * Unknown types render an explicit error panel (D-05).
 *
 * Forwards a unified ChartRef for export and fullscreen functionality.
 */
export const ChartFactory = forwardRef<ChartRef, ChartWrapperProps>(function ChartFactory(props, ref) {
  const agRef = useRef<AgChartRef>(null)
  const echartRef = useRef<EChartRef>(null)
  const isEChart = ECHART_TYPES.has(props.config.vizType)

  useImperativeHandle(ref, () => ({
    supportsSVG: isEChart,

    downloadImage(format: 'png' | 'svg', fileName: string) {
      if (isEChart) {
        const dataURL = echartRef.current?.getDataURL({ type: format, pixelRatio: EXPORT_PIXEL_RATIO })
        if (dataURL) {
          triggerDownloadFromDataURL(dataURL, fileName)
          toast.success(`Chart exported as ${format.toUpperCase()}`)
        }
      } else {
        if (format === 'svg') {
          toast.error('SVG export is not available for this chart type')
          return
        }
        agRef.current?.download(fileName)
        toast.success('Chart exported as PNG')
      }
    },

    exportCSV(fileName: string) {
      const data = agRef.current?.getData() ?? echartRef.current?.getData()
      if (data) {
        downloadCSV(data.columns, data.rows, fileName)
      }
    },

    async copyToClipboard() {
      const data = agRef.current?.getData() ?? echartRef.current?.getData()
      if (data) {
        await copyDataToClipboard(data.columns, data.rows)
      }
    },
  }), [isEChart])

  if (isEChart) {
    return <EChartWrapper ref={echartRef} {...props} />
  }
  if (!SUPPORTED_AG_TYPES.has(props.config.vizType)) {
    return <UnsupportedChartError vizType={props.config.vizType} />
  }
  return <AgChartWrapper ref={agRef} {...props} />
})
