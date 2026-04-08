import { expect, test } from '@playwright/test'

import { CURATED_DASHBOARDS } from './_fixtures'

/**
 * Phase 8/9 dashboard EDIT route regression — rewritten for Phase 10 Plan
 * 10-01c against the curated test catalog.
 *
 * Originally introduced as a regression for the Phase 9 hook upgrade
 * (`useDashboardConfig` → `useManagedDashboard`) and the BuilderPage mount
 * path. Now points at `dash-match-rate` from the seeded curated catalog
 * (chosen because it has a line chart with drill-hierarchy, exercising the
 * Phase 8 panel-render code path that the original regression caught).
 */

const { matchRate } = CURATED_DASHBOARDS

test.describe('Dashboard edit route — Phase 8 hook regression (curated dash-match-rate)', () => {
  test('the curated dash-match-rate dashboard loads on /dashboards/:id/edit', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(`/dashboards/${matchRate.id}/edit`)

    // The "Dashboard not found" fallback must NOT be present after load.
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Dashboard not found')).toHaveCount(0)

    // Wait for a recognisable BuilderPage element. The BuilderToolbar
    // contains a Save button OR the AddContentMenu trigger ("Add Content").
    const builderHeuristic = page
      .locator('button', { hasText: /save/i })
      .or(page.locator('text=Add Content'))
      .or(page.locator('[data-builder-page]'))
    await expect(builderHeuristic.first()).toBeVisible({ timeout: 15_000 })

    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
  })
})
