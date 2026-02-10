import type { ChartType, ChartLibrary } from '@/types/chart'

import { AgChartWrapper } from './ag-chart-wrapper'
import type { ChartWrapperProps } from './ag-chart-wrapper'
import { EChartWrapper } from './echart-wrapper'

const ECHART_TYPES: ReadonlySet<ChartType> = new Set<ChartType>([
  'sankey',
  'sunburst',
  'radar',
  'graph',
  'gauge',
  'parallel',
  'funnel',
])

/** Determine which chart library should render a given chart type */
export function getChartLibrary(type: ChartType): ChartLibrary {
  return ECHART_TYPES.has(type) ? 'echarts' : 'ag-charts'
}

export interface ChartFactoryProps extends ChartWrapperProps {
  chartType: ChartType
}

export function ChartFactory({ chartType, ...props }: ChartFactoryProps) {
  const library = getChartLibrary(chartType)

  if (library === 'echarts') {
    return <EChartWrapper {...props} />
  }

  return <AgChartWrapper {...props} />
}
