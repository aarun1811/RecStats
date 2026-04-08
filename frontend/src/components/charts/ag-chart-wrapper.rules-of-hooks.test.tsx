// @vitest-environment jsdom
/**
 * Rules-of-Hooks guard for AgChartWrapper.
 *
 * This test file exists separately from `ag-chart-wrapper.test.ts` because
 * that file is a pure `buildSeries` unit-test module (node environment, no
 * JSX). This file renders the real `<AgChartWrapper>` component under every
 * early-return branch and verifies React never logs a "Rendered fewer hooks
 * than expected" warning — which is the symptom of the Rules-of-Hooks
 * violation that existed pre-Phase-10 at ag-chart-wrapper.tsx:378-379.
 *
 * Plan 10-01a Task 2 hoisted `containerRef`, `containerSize`, the
 * ResizeObserver effect, and the `sizedOptions` useMemo above the four early
 * returns. Without that fix, going from an early-return render to a
 * "happy path" render (or vice versa) would mutate the hook count and React
 * would warn — or crash in strict mode.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import { AgChartWrapper } from './ag-chart-wrapper'
import type { ChartConfig, ChartDataResponse } from '@/types/chart'

// AG Charts pulls in a lot of browser globals — mock the component to a
// simple marker so we can focus on hook ordering without wiring jsdom to
// the real canvas-rendered enterprise build.
vi.mock('ag-charts-react', () => ({
  AgCharts: () => null,
}))

// getAgChartsTheme reads from DOM CSS variables; return a fixed object for
// a predictable useState initializer.
vi.mock('@/lib/chart-themes', () => ({
  getAgChartsTheme: () => ({ palette: { fills: [], strokes: [] }, overrides: {} }),
}))

// ThemeProvider relies on window.matchMedia which jsdom does not polyfill
// by default. Bypass the provider entirely by stubbing useTheme to return
// a fixed resolved theme.
vi.mock('@/components/layout/theme-provider', () => ({
  useTheme: () => ({ theme: 'light', setTheme: () => {}, resolvedTheme: 'light' }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// ResizeObserver is not provided by jsdom. Stub it so the useEffect can
// instantiate one without throwing.
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
;(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver

const BASE_CONFIG: ChartConfig = {
  id: 'guard-chart',
  name: 'Guard Chart',
  vizType: 'bar',
  datasourceId: 0,
  metricColumns: ['value'],
  categoryColumn: 'category',
}

const HAPPY_DATA: ChartDataResponse = {
  chartId: 'guard-chart',
  columns: ['category', 'value'],
  data: [
    { category: 'A', value: 10 },
    { category: 'B', value: 20 },
  ],
  rowCount: 2,
}

function renderInTheme(
  props: Parameters<typeof AgChartWrapper>[0],
): ReturnType<typeof render> {
  return render(<AgChartWrapper {...props} />)
}

describe('AgChartWrapper — Rules of Hooks guard', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    cleanup()
  })

  it('renders isLoading state without hook count warnings', () => {
    renderInTheme({
      chartId: 'guard-chart',
      config: BASE_CONFIG,
      isLoading: true,
    })
    for (const call of consoleErrorSpy.mock.calls) {
      const msg = String(call[0] ?? '')
      expect(msg).not.toMatch(/Rendered fewer hooks/)
      expect(msg).not.toMatch(/Rendered more hooks/)
    }
  })

  it('renders error state without hook count warnings', () => {
    renderInTheme({
      chartId: 'guard-chart',
      config: BASE_CONFIG,
      error: new Error('boom'),
    })
    for (const call of consoleErrorSpy.mock.calls) {
      const msg = String(call[0] ?? '')
      expect(msg).not.toMatch(/Rendered fewer hooks/)
      expect(msg).not.toMatch(/Rendered more hooks/)
    }
  })

  it('renders empty-data state without hook count warnings', () => {
    renderInTheme({
      chartId: 'guard-chart',
      config: BASE_CONFIG,
      data: {
        chartId: 'guard-chart',
        columns: ['category', 'value'],
        data: [],
        rowCount: 0,
      },
    })
    for (const call of consoleErrorSpy.mock.calls) {
      const msg = String(call[0] ?? '')
      expect(msg).not.toMatch(/Rendered fewer hooks/)
      expect(msg).not.toMatch(/Rendered more hooks/)
    }
  })

  it('renders missing-column state without hook count warnings', () => {
    renderInTheme({
      chartId: 'guard-chart',
      config: { ...BASE_CONFIG, metricColumns: ['not_in_data'] },
      data: HAPPY_DATA,
    })
    for (const call of consoleErrorSpy.mock.calls) {
      const msg = String(call[0] ?? '')
      expect(msg).not.toMatch(/Rendered fewer hooks/)
      expect(msg).not.toMatch(/Rendered more hooks/)
    }
  })

  it('renders happy-path state without hook count warnings', () => {
    renderInTheme({
      chartId: 'guard-chart',
      config: BASE_CONFIG,
      data: HAPPY_DATA,
    })
    for (const call of consoleErrorSpy.mock.calls) {
      const msg = String(call[0] ?? '')
      expect(msg).not.toMatch(/Rendered fewer hooks/)
      expect(msg).not.toMatch(/Rendered more hooks/)
    }
  })
})
