import { expect, test, type Page } from '@playwright/test'

import { CURATED_DASHBOARDS } from './_fixtures'

/**
 * SHAR-03 — Embed mode hardening (Phase 9 Plan 09-02), rewritten for Phase 10
 * Plan 10-01c against the curated test catalog.
 *
 * Verifies the embed route (`/embed/dashboards/:id`) end-to-end against the
 * seeded `dash-volume` dashboard (Phase 10 · Volume Dashboard). Replaces the
 * old POST/DELETE ephemeral seed pattern with stable curated slugs.
 *
 *   - Test 1: baseline embed loads the seeded managed dashboard
 *   - Test 2: ?theme=dark applies dark mode
 *   - Test 3: ?filter.region_code=EMEA pre-applies the region filter
 *   - Test 4: ?filter.lock=region_code disables the region filter control
 *   - Test 5: ?hide=filter-bar removes the ConfigFilterBar
 *   - Test 6: ?hide=title hides the topbar title text but keeps the bar/link
 *   - Test 7: ?hide=toolbar hides the DashboardToolbar refresh button
 *   - Test 8: ?hide=filter-bar,title,toolbar removes all three in one request
 *
 * `dash-volume` is chosen because it exercises both cross-filter source charts
 * (treemap, bar) and a region-bound filter, making it the densest embed test
 * target in the curated catalog.
 */

const { volume } = CURATED_DASHBOARDS

/**
 * Wait until the embed route is "settled" — the EmbedTopbar is visible
 * (the "Open in RecViz" link).
 */
async function waitForEmbedLoaded(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('text=Open in RecViz')).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('SHAR-03 embed mode (curated dash-volume)', () => {
  test('loads a managed dashboard from /embed/dashboards/:id', async ({
    page,
  }) => {
    // Track only plan-scope console errors. Filter out resource load
    // failures and KPI endpoint noise so this assertion stays focused on
    // the embed-route itself.
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('Failed to load resource')) return
      if (text.includes('/kpis')) return
      consoleErrors.push(text)
    })

    await page.goto(`/embed/dashboards/${volume.id}`)
    await waitForEmbedLoaded(page)

    // EmbedTopbar shows the curated dashboard name.
    await expect(page.locator(`text=${volume.name}`).first()).toBeVisible({
      timeout: 10_000,
    })
    // Fallback string must NOT be present.
    await expect(page.locator('text=Dashboard not found')).toHaveCount(0)
    // No plan-scope console errors.
    expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
  })

  test('?theme=dark applies dark mode', async ({ page }) => {
    await page.goto(`/embed/dashboards/${volume.id}?theme=dark`)
    await waitForEmbedLoaded(page)

    // ThemeProvider toggles the `dark` class on `<html>`.
    await expect(page.locator('html')).toHaveClass(/dark/, {
      timeout: 5_000,
    })
  })

  test('?filter.region_code=EMEA pre-applies the region filter', async ({
    page,
  }) => {
    await page.goto(
      `/embed/dashboards/${volume.id}?filter.region_code=EMEA`,
    )
    await waitForEmbedLoaded(page)

    // The ConfigFilterBar's MultiSelectFilter renders a Shadcn-styled trigger
    // with `data-slot="select-trigger"`. Selected EMEA appears inside it.
    const regionTrigger = page.locator('[data-slot="select-trigger"]').first()
    await expect(regionTrigger).toBeVisible({ timeout: 10_000 })
    await expect(regionTrigger).toContainText('EMEA', { timeout: 10_000 })
  })

  test('?filter.lock=region_code disables the region filter control', async ({
    page,
  }) => {
    await page.goto(
      `/embed/dashboards/${volume.id}?filter.lock=region_code`,
    )
    await waitForEmbedLoaded(page)

    // ConfigFilterBar renders a lucide Lock icon next to a locked filter.
    await expect(page.locator('.lucide-lock').first()).toBeVisible({
      timeout: 10_000,
    })
    // The Select trigger itself is disabled (Radix applies `disabled` on
    // the trigger button when the Select is disabled).
    const regionTrigger = page.locator('[data-slot="select-trigger"]').first()
    await expect(regionTrigger).toBeVisible({ timeout: 10_000 })
    await expect(regionTrigger).toBeDisabled()
  })

  test('?hide=filter-bar removes the ConfigFilterBar from the DOM', async ({
    page,
  }) => {
    await page.goto(`/embed/dashboards/${volume.id}?hide=filter-bar`)
    await waitForEmbedLoaded(page)

    // No filter-bar Apply button.
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0)
    // EmbedTopbar still visible.
    await expect(page.locator('text=Open in RecViz')).toBeVisible()
  })

  test('?hide=title hides the topbar title but keeps the bar and the link', async ({
    page,
  }) => {
    await page.goto(`/embed/dashboards/${volume.id}?hide=title`)
    await waitForEmbedLoaded(page)

    await expect(page.locator('text=Open in RecViz')).toBeVisible()
    // The dashboard name should NOT appear inside the embed topbar slot
    // (the `.h-9` border-b container scopes the negative assertion).
    const topbarTitleCount = await page
      .locator(`.h-9 >> text=${volume.name}`)
      .count()
    expect(topbarTitleCount).toBe(0)
  })

  test('?hide=toolbar hides the DashboardToolbar refresh button (EmbedTopbar stays)', async ({
    page,
  }) => {
    await page.goto(`/embed/dashboards/${volume.id}?hide=toolbar`)
    await waitForEmbedLoaded(page)

    // No Refresh button from the DashboardToolbar.
    await expect(
      page.getByRole('button', { name: /refresh all dashboard data/i }),
    ).toHaveCount(0)
    // EmbedTopbar + its title still visible.
    await expect(page.locator('text=Open in RecViz')).toBeVisible()
    await expect(page.locator(`text=${volume.name}`).first()).toBeVisible()
    // Filter bar still visible.
    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
  })

  test('?hide=filter-bar,title,toolbar removes all three in one request', async ({
    page,
  }) => {
    await page.goto(
      `/embed/dashboards/${volume.id}?hide=filter-bar,title,toolbar`,
    )
    await waitForEmbedLoaded(page)

    // Only the "Open in RecViz" link remains in the topbar.
    await expect(page.locator('text=Open in RecViz')).toBeVisible()
    // No filter bar.
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0)
    // No DashboardToolbar refresh button.
    await expect(
      page.getByRole('button', { name: /refresh all dashboard data/i }),
    ).toHaveCount(0)
  })
})
