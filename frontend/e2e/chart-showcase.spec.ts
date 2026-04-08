import { expect, test } from '@playwright/test'

import { CURATED_DASHBOARDS, waitForDashboardLoad } from './_fixtures'

/**
 * Phase 10 — Dashboard smoke (rewritten from the legacy chart-showcase spec).
 *
 * Walks every curated dashboard in `CURATED_DASHBOARDS` once and asserts:
 *   1. The dashboard loads without any error panels.
 *   2. At least one chart canvas (AG Charts) or ECharts instance renders.
 *   3. The KPI row contains numeric values (not the fallback em-dash `—`).
 *
 * The 5 curated dashboards collectively cover all 18 working chart types
 * (AG: bar, stacked-bar, line, area, pie, donut, scatter, heatmap, treemap,
 * waterfall, combo, histogram. ECharts: sankey, radar, gauge, funnel, graph,
 * parallel) plus the three inverted-threshold KPIs.
 *
 * This spec replaces the old per-chart-title loop against the dead
 * `chart-showcase` dashboard.
 */

const DASHBOARDS = Object.entries(CURATED_DASHBOARDS) as Array<
  [string, (typeof CURATED_DASHBOARDS)[keyof typeof CURATED_DASHBOARDS]]
>

for (const [key, dashboard] of DASHBOARDS) {
  test.describe(`${dashboard.name} (${key})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/dashboards/${dashboard.id}`)
      await waitForDashboardLoad(page, dashboard.name)
    })

    test('renders without error panels', async ({ page }) => {
      await expect(page.locator('text=Column mapping error')).toHaveCount(0)
      await expect(page.locator('text=Unsupported chart type')).toHaveCount(0)
      await expect(page.locator('text=Failed to load')).toHaveCount(0)
      await expect(page.locator('text=Data source not found')).toHaveCount(0)
      await expect(page.locator('text=Dashboard not found')).toHaveCount(0)
    })

    test('renders at least one chart surface (canvas or ECharts)', async ({
      page,
    }) => {
      // AG Charts render into <canvas>; ECharts register an
      // _echarts_instance_ attribute on their container div.
      const chartSurface = page
        .locator('canvas, [_echarts_instance_]')
        .first()
      await expect(chartSurface).toBeVisible({ timeout: 15_000 })
    })

    test('KPI row shows numeric values', async ({ page }) => {
      // ConfigKpiRow renders the KPI value inside a div with the classes
      // `text-2xl font-semibold tabular-nums tracking-tight`. The div wraps a
      // motion.span from CountAnimation carrying the formatted value.
      const kpiValueContainers = page.locator(
        'div.text-2xl.font-semibold.tabular-nums.tracking-tight',
      )
      await expect(kpiValueContainers.first()).toBeVisible({ timeout: 15_000 })

      // The fallback rendering for an unresolved KPI is a single em-dash.
      // None of the first N KPI values should be exactly `—`.
      const count = await kpiValueContainers.count()
      expect(count).toBeGreaterThan(0)
      for (let i = 0; i < count; i += 1) {
        const text = (await kpiValueContainers.nth(i).innerText()).trim()
        expect(text, `KPI #${i} rendered as placeholder`).not.toBe('—')
        expect(text.length, `KPI #${i} rendered empty`).toBeGreaterThan(0)
      }
    })
  })
}
