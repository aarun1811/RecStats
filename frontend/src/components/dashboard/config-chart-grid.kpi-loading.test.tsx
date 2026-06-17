// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'

// KpiValuesChartItem reads crossFilters/addCrossFilter from the filter store and
// (via useCrossFilter) crossFilters again. Provide a static empty store.
vi.mock('@/stores/filter-store', () => ({
  useFilterStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ crossFilters: [], addCrossFilter: () => {}, applied: {} }),
}))

// Stub the chart so we can assert "chart rendered" vs "skeleton shown" without
// pulling in AG-Charts. Its presence is the signal that data is being shown.
vi.mock('@/components/charts/chart-factory', () => ({
  ChartFactory: () => React.createElement('div', { 'data-testid': 'chart-factory' }),
}))

import { ConfigChartGrid } from './config-chart-grid'

// Minimal kpi_values (donut) chart — the TLM Stats dashboard's donut shape.
const kpiDonut = {
  id: 'c-donut',
  title: 'Match vs Break',
  type: 'donut',
  sourceType: 'kpi_values',
  layout: { width: 6, height: 4 },
  kpiSegments: [
    { label: 'Matched', kpiId: 'k-matched' },
    { label: 'Broken', kpiId: 'k-broken' },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

describe('ConfigChartGrid — kpi_values loading state', () => {
  it('shows a skeleton (and NOT the chart) while KPIs are still loading', () => {
    const { container, queryByTestId } = render(
      <ConfigChartGrid charts={[kpiDonut]} kpiResults={undefined} kpisLoading />,
    )
    // The empty donut must not render mid-load.
    expect(queryByTestId('chart-factory')).toBeNull()
    // A loading skeleton stands in for it instead.
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it('renders the chart once KPI results are available', () => {
    const { getByTestId } = render(
      <ConfigChartGrid
        charts={[kpiDonut]}
        kpiResults={[
          { id: 'k-matched', value: 80 },
          { id: 'k-broken', value: 20 },
        ]}
        kpisLoading={false}
      />,
    )
    expect(getByTestId('chart-factory')).toBeInTheDocument()
  })
})
