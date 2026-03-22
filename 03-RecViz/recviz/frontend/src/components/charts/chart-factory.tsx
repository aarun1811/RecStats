import type { ChartWrapperProps } from '@/types/chart'
import { AgChartWrapper } from './ag-chart-wrapper'
import { EChartWrapper } from './echart-wrapper'

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

/**
 * Routes to the correct chart wrapper based on viz type.
 * AG Charts handles standard types (bar, line, area, pie, donut, scatter, etc.).
 * ECharts handles exotic types (sankey, radar, sunburst, gauge, funnel, graph, parallel).
 */
export function ChartFactory(props: ChartWrapperProps) {
  if (ECHART_TYPES.has(props.config.vizType)) {
    return <EChartWrapper {...props} />
  }
  return <AgChartWrapper {...props} />
}
