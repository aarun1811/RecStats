import type { ChartWrapperProps } from '@/types/chart'
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
])

/**
 * Routes to the correct chart wrapper based on viz type.
 * AG Charts handles standard types (bar, line, area, pie, donut, scatter, etc.).
 * ECharts handles exotic types (sankey, radar, sunburst, gauge, funnel, graph, parallel).
 * Unknown types render an explicit error panel (D-05).
 */
export function ChartFactory(props: ChartWrapperProps) {
  if (ECHART_TYPES.has(props.config.vizType)) {
    return <EChartWrapper {...props} />
  }
  if (!SUPPORTED_AG_TYPES.has(props.config.vizType)) {
    return <UnsupportedChartError vizType={props.config.vizType} />
  }
  return <AgChartWrapper {...props} />
}
