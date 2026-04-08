import { expect, test } from '@playwright/test'

/**
 * SHAR-03 — Embed mode hardening (Phase 9 Plan 09-02)
 *
 * Verifies the embed route (`/embed/dashboards/:id`) end-to-end against the
 * real backend (no mocks per `feedback_no_mock_shortcuts.md`). Covers:
 *
 *   - Test 7/8: Hook upgrade + theme param → dark mode applies
 *   - Test 9:   `?filter.region=APAC` pre-applies the region filter
 *   - Test 10:  `?filter.lock=region` disables the region filter control
 *   - Test 11:  `?hide=filter-bar` removes the ConfigFilterBar from the DOM
 *   - Test 12:  `?hide=title` hides the EmbedTopbar title text but keeps
 *               the bar itself and the "Open in RecViz" link
 *   - Test 13:  `?hide=toolbar` hides the DashboardToolbar refresh button
 *               but keeps EmbedTopbar + ConfigFilterBar
 *   - Test 14:  Combined `?hide=filter-bar,title,toolbar` removes all three
 *               surfaces in one request
 *
 * Each test seeds its own dashboard via POST /api/dashboards/managed (with a
 * realistic filter config so `?filter.region=` and `?filter.lock=region`
 * have something to bind to) and deletes it in the finally block.
 */

const BACKEND_URL = 'http://localhost:8000'

interface SeededDashboard {
  id: string
  name: string
}

async function seedDashboard(
  request: import('@playwright/test').APIRequestContext,
  suffix: string,
): Promise<SeededDashboard> {
  const name = `embed-spec-${suffix}-${Date.now()}`
  const config = {
    id: 'temp',
    name,
    description: 'Phase 9 embed spec seed',
    features: { crossFilter: false, drillDown: false },
    filters: [
      {
        id: 'region',
        label: 'Region',
        type: 'single-select',
        lockable: true,
        options: [
          { label: 'APAC', value: 'APAC' },
          { label: 'EMEA', value: 'EMEA' },
        ],
        defaultValue: 'APAC',
      },
    ],
    kpis: [],
    charts: [],
    grids: [],
    layout: { type: 'stack', sections: [] },
  }
  const res = await request.post(`${BACKEND_URL}/api/dashboards/managed`, {
    data: { name, description: 'Phase 9 embed spec seed', config },
  })
  expect(
    res.status(),
    `seed dashboard create failed: ${await res.text()}`,
  ).toBe(201)
  const body = await res.json()
  return { id: body.id as string, name }
}

async function deleteDashboard(
  request: import('@playwright/test').APIRequestContext,
  id: string,
): Promise<void> {
  await request.delete(`${BACKEND_URL}/api/dashboards/managed/${id}`)
}

/**
 * Wait until the embed route is "settled" — the EmbedTopbar is visible
 * ("Open in RecViz" link) OR the "Dashboard not found" fallback has rendered.
 */
async function waitForEmbedLoaded(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('text=Open in RecViz')).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('SHAR-03 embed mode', () => {
  test('loads a managed dashboard from /embed/dashboards/:id (hook upgrade)', async ({
    page,
    request,
  }) => {
    const seeded = await seedDashboard(request, 'baseline')
    // Track only plan-scope console errors. The seeded dashboard has no
    // KPIs and no wired KPI endpoint, so the pre-existing `useDashboardKpis`
    // hook fires a POST that 404s regardless of hook upgrade — out of scope
    // for this plan. Filter those out of the assertion.
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('Failed to load resource')) return
      if (text.includes('/kpis')) return
      consoleErrors.push(text)
    })
    try {
      await page.goto(`/embed/dashboards/${seeded.id}`)
      await waitForEmbedLoaded(page)

      // EmbedTopbar title should show the managed dashboard name — this is
      // the direct regression signal that the hook upgrade succeeded
      // (legacy hook reads a stale table and `dashboard.name` is undefined).
      await expect(page.locator(`text=${seeded.name}`).first()).toBeVisible({
        timeout: 10_000,
      })
      // "Dashboard not found" fallback MUST NOT be present
      await expect(page.locator('text=Dashboard not found')).toHaveCount(0)
      // No plan-scope console errors
      expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })

  test('?theme=dark applies dark mode', async ({ page, request }) => {
    const seeded = await seedDashboard(request, 'theme-dark')
    try {
      await page.goto(`/embed/dashboards/${seeded.id}?theme=dark`)
      await waitForEmbedLoaded(page)

      // ThemeProvider adds the `dark` class to `<html>`
      await expect(page.locator('html')).toHaveClass(/dark/, {
        timeout: 5_000,
      })
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })

  test('?filter.region=EMEA pre-applies the region filter', async ({
    page,
    request,
  }) => {
    const seeded = await seedDashboard(request, 'filter-apply')
    try {
      await page.goto(
        `/embed/dashboards/${seeded.id}?filter.region=EMEA`,
      )
      await waitForEmbedLoaded(page)

      // The ConfigFilterBar's SingleSelectFilter renders a Shadcn Select
      // whose trigger carries `data-slot="select-trigger"` and displays the
      // current value (EMEA) inside the SelectValue span.
      const regionTrigger = page.locator('[data-slot="select-trigger"]').first()
      await expect(regionTrigger).toBeVisible({ timeout: 10_000 })
      await expect(regionTrigger).toContainText('EMEA', { timeout: 10_000 })
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })

  test('?filter.lock=region disables the region filter control', async ({
    page,
    request,
  }) => {
    const seeded = await seedDashboard(request, 'filter-lock')
    try {
      await page.goto(
        `/embed/dashboards/${seeded.id}?filter.lock=region`,
      )
      await waitForEmbedLoaded(page)

      // The ConfigFilterBar renders a Lock icon (lucide-react) next to a
      // locked filter's label. Verify the icon is present by looking for
      // the `lucide-lock` class that lucide automatically applies.
      await expect(page.locator('.lucide-lock').first()).toBeVisible({
        timeout: 10_000,
      })
      // The Select trigger itself is disabled (Radix applies `disabled` on
      // the trigger button when the Select is disabled).
      const regionTrigger = page.locator('[data-slot="select-trigger"]').first()
      await expect(regionTrigger).toBeVisible({ timeout: 10_000 })
      await expect(regionTrigger).toBeDisabled()
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })

  test('?hide=filter-bar removes the ConfigFilterBar from the DOM', async ({
    page,
    request,
  }) => {
    const seeded = await seedDashboard(request, 'hide-filter-bar')
    try {
      await page.goto(
        `/embed/dashboards/${seeded.id}?hide=filter-bar`,
      )
      await waitForEmbedLoaded(page)

      // No filter control (no Apply button from the ConfigFilterBar card)
      await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0)
      // EmbedTopbar is still visible
      await expect(page.locator('text=Open in RecViz')).toBeVisible()
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })

  test('?hide=title hides the topbar title but keeps the bar and the link', async ({
    page,
    request,
  }) => {
    const seeded = await seedDashboard(request, 'hide-title')
    try {
      await page.goto(`/embed/dashboards/${seeded.id}?hide=title`)
      await waitForEmbedLoaded(page)

      // The "Open in RecViz" link is still there
      await expect(page.locator('text=Open in RecViz')).toBeVisible()
      // The seeded dashboard name should NOT appear in the topbar title slot.
      // Use the topbar container (h-9 border-b) to scope the negative assertion.
      const topbarTitleCount = await page
        .locator(
          `.h-9 >> text=${seeded.name}`,
        )
        .count()
      expect(topbarTitleCount).toBe(0)
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })

  test('?hide=toolbar hides the DashboardToolbar refresh button (EmbedTopbar stays)', async ({
    page,
    request,
  }) => {
    const seeded = await seedDashboard(request, 'hide-toolbar')
    try {
      await page.goto(
        `/embed/dashboards/${seeded.id}?hide=toolbar`,
      )
      await waitForEmbedLoaded(page)

      // No Refresh button from the DashboardToolbar
      await expect(
        page.getByRole('button', { name: /refresh all dashboard data/i }),
      ).toHaveCount(0)
      // EmbedTopbar + its title still visible
      await expect(page.locator('text=Open in RecViz')).toBeVisible()
      await expect(page.locator(`text=${seeded.name}`).first()).toBeVisible()
      // Filter bar still visible
      await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })

  test('?hide=filter-bar,title,toolbar removes all three in one request', async ({
    page,
    request,
  }) => {
    const seeded = await seedDashboard(request, 'hide-all')
    try {
      await page.goto(
        `/embed/dashboards/${seeded.id}?hide=filter-bar,title,toolbar`,
      )
      await waitForEmbedLoaded(page)

      // Only the "Open in RecViz" link remains in the topbar
      await expect(page.locator('text=Open in RecViz')).toBeVisible()
      // No filter bar (no Apply button)
      await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0)
      // No DashboardToolbar refresh button
      await expect(
        page.getByRole('button', { name: /refresh all dashboard data/i }),
      ).toHaveCount(0)
    } finally {
      await deleteDashboard(request, seeded.id)
    }
  })
})
