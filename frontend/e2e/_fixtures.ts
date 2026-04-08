import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Phase 10 — shared E2E fixture map.
 *
 * Single source of truth for the curated test catalog slugs and display
 * names. All rewritten Playwright specs (Plan 10-01c) import from this file
 * so the catalog lives in ONE place. Seed script (Plan 10-01b) mirrors
 * DASHBOARD_NAMES exactly; the cross-check is enforced by
 * `test_dashboard_names_match_fixtures` in `backend/tests/test_seed_script.py`
 * (Plan 10-01b Task 4 unskips and implements that assertion).
 *
 * Entity sources:
 * - RESEARCH.md §2.1 — 16 datasets
 * - RESEARCH.md §2.2 — 22 charts (covering all 18 working types)
 * - RESEARCH.md §2.3 — 12 KPIs
 * - RESEARCH.md §2.4 — 5 dashboards
 */

/**
 * Canonical source of truth for dashboard.name values. The seed script in
 * Plan 10-01b mirrors these strings character-for-character. M-3 cross-check
 * convention: every dashboard name is prefixed `Phase 10 ·` so curated catalog
 * entities are visually distinct from user-created experiments during UAT.
 */
export const DASHBOARD_NAMES = {
  'dash-sla': 'Phase 10 · SLA Overview',
  'dash-aging': 'Phase 10 · Aging Analysis',
  'dash-match-rate': 'Phase 10 · Match Rate Tracker',
  'dash-volume': 'Phase 10 · Volume Dashboard',
  'dash-breaks-summary': 'Phase 10 · Breaks Summary',
} as const

export type DashboardId = keyof typeof DASHBOARD_NAMES

/** Curated dashboards keyed by short handle. Five in total per D-04. */
export const CURATED_DASHBOARDS = {
  sla: { id: 'dash-sla', name: DASHBOARD_NAMES['dash-sla'] },
  aging: { id: 'dash-aging', name: DASHBOARD_NAMES['dash-aging'] },
  matchRate: { id: 'dash-match-rate', name: DASHBOARD_NAMES['dash-match-rate'] },
  volume: { id: 'dash-volume', name: DASHBOARD_NAMES['dash-volume'] },
  breaksSummary: {
    id: 'dash-breaks-summary',
    name: DASHBOARD_NAMES['dash-breaks-summary'],
  },
} as const

/**
 * Curated chart catalog. Slug → { id, name, type }.
 * Source: RESEARCH.md §2.2 (22 charts, covering all 18 working chart types).
 */
export const CURATED_CHARTS = {
  txnTrendLine: {
    id: 'chart-txn-trend-line',
    name: 'Transaction Volume — Daily',
    type: 'line',
  },
  txnTrendArea: {
    id: 'chart-txn-trend-area',
    name: 'Transaction Amount — Daily',
    type: 'area',
  },
  txnByRegionBar: {
    id: 'chart-txn-by-region-bar',
    name: 'Transactions by Region',
    type: 'bar',
  },
  txnByRegionPie: {
    id: 'chart-txn-by-region-pie',
    name: 'Transactions by Region (share)',
    type: 'pie',
  },
  txnStatusDonut: {
    id: 'chart-txn-status-donut',
    name: 'Match Status',
    type: 'donut',
  },
  txnStatusStacked: {
    id: 'chart-txn-status-stacked',
    name: 'Status by Region',
    type: 'stacked-bar',
  },
  breaksByType: {
    id: 'chart-breaks-by-type',
    name: 'Breaks by Type',
    type: 'bar',
  },
  breaksAgingWaterfall: {
    id: 'chart-breaks-aging-waterfall',
    name: 'Aging Waterfall',
    type: 'waterfall',
  },
  breaksAgingBar: {
    id: 'chart-breaks-aging-bar',
    name: 'Aging Distribution',
    type: 'bar',
  },
  volumeDeskTreemap: {
    id: 'chart-volume-desk-treemap',
    name: 'Desk Volume Treemap',
    type: 'treemap',
  },
  txnScatter: {
    id: 'chart-txn-scatter',
    name: 'Amount vs Fee',
    type: 'scatter',
  },
  slaHeatmap: {
    id: 'chart-sla-heatmap',
    name: 'SLA Breach Heatmap',
    type: 'heatmap',
  },
  txnCombo: {
    id: 'chart-txn-combo',
    name: 'Volume & Amount Combo',
    type: 'combo',
  },
  breaksHistogram: {
    id: 'chart-breaks-histogram',
    name: 'Break Amount Distribution',
    type: 'histogram',
  },
  breakFlowSankey: {
    id: 'chart-break-flow-sankey',
    name: 'Break Flow',
    type: 'sankey',
  },
  kpiRadar: {
    id: 'chart-kpi-radar',
    name: 'KPI Scorecard',
    type: 'radar',
  },
  matchRateGauge: {
    id: 'chart-match-rate-gauge',
    name: 'Match Rate Gauge',
    type: 'gauge',
  },
  matchFunnel: {
    id: 'chart-match-funnel',
    name: 'Match Type Funnel',
    type: 'funnel',
  },
  reconGraph: {
    id: 'chart-recon-graph',
    name: 'Recon Graph Network',
    type: 'graph',
  },
  txnParallel: {
    id: 'chart-txn-parallel',
    name: 'Transaction Parallel Coords',
    type: 'parallel',
  },
  currencyPie: {
    id: 'chart-currency-pie',
    name: 'Currency Distribution',
    type: 'pie',
  },
  counterpartyTopBar: {
    id: 'chart-counterparty-top-bar',
    name: 'Top 20 Counterparties',
    type: 'bar',
  },
} as const

/**
 * Curated dataset catalog. Slug → { id, name }.
 * Source: RESEARCH.md §2.1 (16 datasets).
 */
export const CURATED_DATASETS = {
  transactionsDaily: {
    id: 'ds-recon-transactions-daily',
    name: 'Transactions — Daily Volume',
  },
  transactionsByRegion: {
    id: 'ds-recon-transactions-by-region',
    name: 'Transactions — By Region',
  },
  transactionsByStatus: {
    id: 'ds-recon-transactions-by-status',
    name: 'Transactions — By Status',
  },
  breaksSummary: {
    id: 'ds-recon-breaks-summary',
    name: 'Breaks — Summary',
  },
  breaksAging: {
    id: 'ds-recon-breaks-aging',
    name: 'Breaks — Aging Distribution',
  },
  matchRateDaily: {
    id: 'ds-recon-match-rate-daily',
    name: 'Match Rate — Daily',
  },
  slaBreachSummary: {
    id: 'ds-sla-breach-summary',
    name: 'SLA — Breach Summary',
  },
  volumeByDesk: {
    id: 'ds-recon-volume-by-desk',
    name: 'Volume — By Desk',
  },
  transactionsScatter: {
    id: 'ds-recon-transactions-scatter',
    name: 'Transactions — Scatter (Amount vs Fee)',
  },
  currencyDistribution: {
    id: 'ds-recon-currency-distribution',
    name: 'Transactions — By Currency',
  },
  matchEventsByType: {
    id: 'ds-recon-match-events-by-type',
    name: 'Match Events — By Type',
  },
  counterpartyTop: {
    id: 'ds-recon-counterparty-top',
    name: 'Counterparties — Top by Volume',
  },
  breakFlowSankey: {
    id: 'ds-recon-break-flow-sankey',
    name: 'Breaks — Flow (Sankey)',
  },
  kpiScorecard: {
    id: 'ds-recon-kpi-scorecard',
    name: 'KPI Scorecard (radar)',
  },
  accountDetail: {
    id: 'ds-recon-account-detail',
    name: 'Accounts — Full Detail (Grid)',
  },
  transactionDetail: {
    id: 'ds-recon-transaction-detail',
    name: 'Transactions — Full Detail (Grid)',
  },
} as const

/**
 * Curated KPI catalog. Slug → { id, name }.
 * Source: RESEARCH.md §2.3 (12 KPIs).
 */
export const CURATED_KPIS = {
  totalTransactions: {
    id: 'kpi-total-transactions',
    name: 'Total Transactions',
  },
  totalAmountUsd: {
    id: 'kpi-total-amount-usd',
    name: 'Total Amount (USD)',
  },
  matchRate: {
    id: 'kpi-match-rate',
    name: 'Match Rate',
  },
  totalBreaks: {
    id: 'kpi-total-breaks',
    name: 'Total Breaks',
  },
  avgAgingDays: {
    id: 'kpi-avg-aging-days',
    name: 'Average Aging (days)',
  },
  slaBreachRate: {
    id: 'kpi-sla-breach-rate',
    name: 'SLA Breach Rate',
  },
  openBreaks: {
    id: 'kpi-open-breaks',
    name: 'Open Breaks',
  },
  autoMatchPct: {
    id: 'kpi-auto-match-pct',
    name: 'Auto-Match %',
  },
  highValueBreaks: {
    id: 'kpi-high-value-breaks',
    name: 'High-Value Break $',
  },
  avgConfidence: {
    id: 'kpi-avg-confidence',
    name: 'Avg Match Confidence',
  },
  txnUniques: {
    id: 'kpi-txn-uniques',
    name: 'Unique References',
  },
  largestTxn: {
    id: 'kpi-largest-txn',
    name: 'Largest Transaction',
  },
} as const

/**
 * Wait for a curated dashboard to reach the loaded-stable state.
 *
 * Preconditions:
 * - The test has already navigated to a route that renders the dashboard.
 * - The dashboard renders an `<h1>` with text equal to `dashboardName`.
 *
 * Postconditions:
 * - The `<h1>` is visible.
 * - All `[data-slot="skeleton"]` instances have been removed from the DOM.
 */
export async function waitForDashboardLoad(
  page: Page,
  dashboardName: string,
): Promise<void> {
  await page
    .locator('h1', { hasText: dashboardName })
    .waitFor({ state: 'visible', timeout: 15_000 })
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}
