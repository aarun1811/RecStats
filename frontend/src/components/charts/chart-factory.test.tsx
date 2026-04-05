// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

import { ChartFactory } from './chart-factory'

// Mock chart wrappers to avoid AG Charts/ECharts browser dependencies
vi.mock('./ag-chart-wrapper', () => ({
  AgChartWrapper: (props: { config?: { vizType?: string } }) => (
    React.createElement('div', { 'data-testid': 'ag-chart', 'data-viztype': props.config?.vizType })
  ),
}))
vi.mock('./echart-wrapper', () => ({
  EChartWrapper: (props: { config?: { vizType?: string } }) => (
    React.createElement('div', { 'data-testid': 'echart', 'data-viztype': props.config?.vizType })
  ),
}))

const baseConfig = {
  id: 'test-1',
  name: 'Test',
  vizType: 'bar',
  datasourceId: 0,
  metricColumns: ['value'],
}

describe('ChartFactory', () => {
  it('routes bar to AgChartWrapper', () => {
    const { getByTestId } = render(
      <ChartFactory chartId="test-1" config={{ ...baseConfig, vizType: 'bar' }} />,
    )
    expect(getByTestId('ag-chart')).toBeDefined()
  })

  it('routes line to AgChartWrapper', () => {
    const { getByTestId } = render(
      <ChartFactory chartId="test-1" config={{ ...baseConfig, vizType: 'line' }} />,
    )
    expect(getByTestId('ag-chart')).toBeDefined()
  })

  it('routes heatmap to AgChartWrapper', () => {
    const { getByTestId } = render(
      <ChartFactory chartId="test-1" config={{ ...baseConfig, vizType: 'heatmap' }} />,
    )
    expect(getByTestId('ag-chart')).toBeDefined()
  })

  it('routes funnel to EChartWrapper', () => {
    const { getByTestId } = render(
      <ChartFactory chartId="test-1" config={{ ...baseConfig, vizType: 'funnel' }} />,
    )
    expect(getByTestId('echart')).toBeDefined()
  })

  it('routes sankey to EChartWrapper', () => {
    const { getByTestId } = render(
      <ChartFactory chartId="test-1" config={{ ...baseConfig, vizType: 'sankey' }} />,
    )
    expect(getByTestId('echart')).toBeDefined()
  })

  it('renders UnsupportedChartError for unknown type', () => {
    const { getByText } = render(
      <ChartFactory chartId="test-1" config={{ ...baseConfig, vizType: 'bullet' }} />,
    )
    expect(getByText('Unsupported chart type')).toBeDefined()
  })
})
