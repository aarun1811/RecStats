import { expect, test } from '@playwright/test'

/**
 * Regression — Phase 8 dashboards still load on the view route after the
 * Phase 9 hook upgrade (useDashboardConfig → useManagedDashboard).
 *
 * Test 25 in 09-VALIDATION.md. Mandatory before plan 09-01 ships.
 *
 * Seeds a real dashboard via POST /api/dashboards/managed (no mocks per
 * project memory feedback_no_mock_shortcuts.md), navigates to /dashboards/{id},
 * asserts the title renders and no console errors fire.
 */

const BACKEND_URL = 'http://localhost:8000'

async function seedDashboard(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/api/dashboards/managed`, {
    data: {
      name,
      description: 'Phase 9 regression seed',
      config: {
        id: 'temp',
        name,
        description: 'Phase 9 regression seed',
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

test.describe('Dashboard view route — Phase 8 hook regression', () => {
  test('a managed dashboard loads on /dashboards/:id with title visible', async ({
    page,
    request,
  }) => {
    const name = `view-regression-${Date.now()}`
    const id = await seedDashboard(request, name)
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    try {
      await page.goto(`/dashboards/${id}`)
      // The h1 should contain the dashboard name
      await expect(page.locator('h1', { hasText: name })).toBeVisible({
        timeout: 15_000,
      })
      // The "Dashboard not found" fallback must NOT be present
      await expect(page.locator('text=Dashboard not found')).toHaveCount(0)
      // No console errors during render
      expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
    } finally {
      await deleteDashboard(request, id)
    }
  })
})
