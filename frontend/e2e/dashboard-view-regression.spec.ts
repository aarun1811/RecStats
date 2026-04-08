import { expect, test } from '@playwright/test'

import { CURATED_DASHBOARDS, waitForDashboardLoad } from './_fixtures'

/**
 * Phase 8/9 dashboard VIEW route regression — rewritten for Phase 10 Plan
 * 10-01c against the curated test catalog.
 *
 * Originally introduced as a regression for the Phase 9 hook upgrade
 * (`useDashboardConfig` → `useManagedDashboard`). Now points at the seeded
 * `dash-volume` (Phase 10 · Volume Dashboard) curated dashboard.
 */

const { volume } = CURATED_DASHBOARDS

test.describe('Dashboard view route — Phase 8 hook regression (curated dash-volume)', () => {
  test('the curated dash-volume dashboard loads on /dashboards/:id with title visible', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(`/dashboards/${volume.id}`)
    await waitForDashboardLoad(page, volume.name)

    // The h1 must contain the curated dashboard name.
    await expect(page.locator('h1', { hasText: volume.name })).toBeVisible({
      timeout: 15_000,
    })
    // The "Dashboard not found" fallback must NOT be present.
    await expect(page.locator('text=Dashboard not found')).toHaveCount(0)
    // No console errors during render.
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
  })
})
