import { expect, test } from '@playwright/test'

/**
 * Regression — Phase 8 dashboards still load on the EDIT route after the
 * Phase 9 hook upgrade (useDashboardConfig → useManagedDashboard).
 *
 * Test 26 in 09-VALIDATION.md. Mandatory before plan 09-01 ships.
 *
 * Seeds a real dashboard via POST /api/dashboards/managed, navigates to
 * /dashboards/{id}/edit, asserts the BuilderPage renders without errors.
 */

const BACKEND_URL = 'http://localhost:8000'

async function seedDashboard(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/api/dashboards/managed`, {
    data: {
      name,
      description: 'Phase 9 edit regression seed',
      config: {
        id: 'temp',
        name,
        description: 'Phase 9 edit regression seed',
        features: { crossFilter: false, drillDown: false },
        filters: [],
        kpis: [],
        charts: [],
        grids: [],
        layout: { type: 'stack', sections: [] },
      },
    },
  })
  expect(
    res.status(),
    `seed dashboard create failed: ${await res.text()}`,
  ).toBe(201)
  const body = await res.json()
  return body.id as string
}

async function deleteDashboard(
  request: import('@playwright/test').APIRequestContext,
  id: string,
): Promise<void> {
  await request.delete(`${BACKEND_URL}/api/dashboards/managed/${id}`)
}

test.describe('Dashboard edit route — Phase 8 hook regression', () => {
  test('a managed dashboard loads on /dashboards/:id/edit (BuilderPage renders)', async ({
    page,
    request,
  }) => {
    const name = `edit-regression-${Date.now()}`
    const id = await seedDashboard(request, name)
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    try {
      await page.goto(`/dashboards/${id}/edit`)

      // The "Dashboard not found" fallback must NOT be present after load
      await page.waitForLoadState('networkidle')
      await expect(page.locator('text=Dashboard not found')).toHaveCount(0)

      // Wait for a recognisable BuilderPage element. The BuilderToolbar
      // contains a "Save" or "Save Dashboard" button — either is acceptable.
      const builderHeuristic = page
        .locator('button', { hasText: /save/i })
        .or(page.locator('text=Add Content'))
        .or(page.locator('[data-builder-page]'))
      await expect(builderHeuristic.first()).toBeVisible({ timeout: 15_000 })

      expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
    } finally {
      await deleteDashboard(request, id)
    }
  })
})
