import type { DashboardConfig } from '@/types/api'

export const MOCK_DASHBOARD_CONFIG: DashboardConfig = {
  id: 'recon-overview',
  title: 'Recon Overview',
  description: 'High-level reconciliation status across all desks and entities',
  charts: [
    {
      id: 'break-trend',
      title: 'Break Trend',
      type: 'area',
      library: 'ag-charts',
      datasetId: 1,
      options: {
        xKey: 'date',
        yKey: 'count',
        seriesGrouping: 'status',
      },
    },
    {
      id: 'breaks-by-type',
      title: 'Breaks by Type',
      type: 'bar',
      library: 'ag-charts',
      datasetId: 2,
      options: {
        xKey: 'type',
        yKey: 'count',
      },
    },
    {
      id: 'breaks-by-desk',
      title: 'Breaks by Desk',
      type: 'donut',
      library: 'ag-charts',
      datasetId: 3,
      options: {
        angleKey: 'count',
        calloutLabelKey: 'desk',
      },
    },
    {
      id: 'aging-distribution',
      title: 'Aging Distribution',
      type: 'bar',
      library: 'ag-charts',
      datasetId: 4,
      options: {
        xKey: 'bucket',
        yKey: 'count',
        seriesGrouping: 'desk',
        stacked: true,
      },
    },
  ],
  crossFilterRules: [
    {
      sourceChartId: 'breaks-by-desk',
      sourceField: 'desk',
      targetChartIds: ['*'],
      targetField: 'desk',
    },
    {
      sourceChartId: 'breaks-by-type',
      sourceField: 'type',
      targetChartIds: ['break-trend', 'aging-distribution'],
      targetField: 'type',
    },
  ],
  layout: [
    { chartId: 'break-trend', row: 0, col: 0, width: 6, height: 1 },
    { chartId: 'breaks-by-type', row: 0, col: 6, width: 6, height: 1 },
    { chartId: 'breaks-by-desk', row: 1, col: 0, width: 6, height: 1 },
    { chartId: 'aging-distribution', row: 1, col: 6, width: 6, height: 1 },
  ],
}

export interface KpiData {
  title: string
  value: number
  previousValue: number
  format: 'number' | 'percent' | 'currency' | 'days'
  invertTrend?: boolean
}

export const MOCK_KPI_DATA: KpiData[] = [
  {
    title: 'Total Breaks',
    value: 1247,
    previousValue: 1389,
    format: 'number',
    invertTrend: true,
  },
  {
    title: 'Resolution Rate',
    value: 87.3,
    previousValue: 82.1,
    format: 'percent',
  },
  {
    title: 'Avg Age',
    value: 3.2,
    previousValue: 4.1,
    format: 'days',
    invertTrend: true,
  },
  {
    title: 'SLA Breaches',
    value: 23,
    previousValue: 31,
    format: 'number',
    invertTrend: true,
  },
]

export const MOCK_ENTITIES = [
  'JPM Securities',
  'Goldman Sachs',
  'Morgan Stanley',
  'Citibank NA',
  'Bank of America',
  'Deutsche Bank',
  'Barclays',
  'HSBC',
  'UBS',
  'Credit Suisse',
]

export const MOCK_STATUSES = ['Open', 'Resolved', 'Pending', 'Escalated']

export const MOCK_DESKS = [
  'All Desks',
  'Operations',
  'Treasury',
  'Fixed Income',
  'Equities',
  'FX',
  'Derivatives',
]
