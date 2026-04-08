import { expect, test } from '@playwright/test'

import { CURATED_DASHBOARDS, waitForDashboardLoad } from './_fixtures'

/**
 * SHAR-02 — Shareable URLs (Phase 9 Plan 09-01), rewritten for Phase 10 Plan
 * 10-01c against the curated test catalog.
 *
 * Verifies bidirectional URL filter-state sync on the dashboard view route
 * against the seeded `dash-sla` dashboard (Phase 10 · SLA Overview):
 *
 *   1. Navigating with `?filter.region_code=NAM` hydrates the filter store on
 *      mount (URL remains populated after settle).
 *   2. The Share button copies the current URL and shows a "Link copied" toast.
 *   3. URL writes use history.replaceState — the back button leaves the
 *      dashboard rather than unwinding filter changes.
 *
 * The spec no longer POSTs ephemeral dashboards; it uses the seeded curated
 * `dash-sla` which lives in `recviz_dashboards` after `seed-postgres.py`.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

const { sla } = CURATED_DASHBOARDS
const REGION_FILTER_ID = 'region_code'
const REGION_FILTER_VALUE_A = 'NAM'
const REGION_FILTER_VALUE_B = 'EMEA'

test.describe('SHAR-02 share link (curated dash-sla)', () => {
  test('hydrates filter store from URL on mount (?filter.region_code=EMEA)', async ({
    page,
  }) => {
    await page.goto(
      `/dashboards/${sla.id}?filter.${REGION_FILTER_ID}=${REGION_FILTER_VALUE_B}`,
    )
    await waitForDashboardLoad(page, sla.name)

    // After debounce, the URL should still contain the filter from the
    // initial navigation — hydration should NOT clear an inbound filter.
    await page.waitForFunction(
      (expected: string) => window.location.search.includes(expected),
      `filter.${REGION_FILTER_ID}=${REGION_FILTER_VALUE_B}`,
      { timeout: 5_000 },
    )
    expect(page.url()).toContain(
      `filter.${REGION_FILTER_ID}=${REGION_FILTER_VALUE_B}`,
    )
  })

  test('Share button copies the current URL and shows a Link copied toast', async ({
    page,
  }) => {
    await page.goto(
      `/dashboards/${sla.id}?filter.${REGION_FILTER_ID}=${REGION_FILTER_VALUE_A}`,
    )
    await waitForDashboardLoad(page, sla.name)

    const shareButton = page.getByRole('button', { name: 'Share' })
    await expect(shareButton).toBeVisible({ timeout: 10_000 })
    await shareButton.click()

    // Sonner toast text appears in the DOM
    await expect(page.locator('text=Link copied')).toBeVisible({
      timeout: 5_000,
    })

    // Clipboard contains the current URL (dashboard path + filter params)
    const clipboard = await page.evaluate(() =>
      navigator.clipboard.readText(),
    )
    expect(clipboard).toContain(`/dashboards/${sla.id}`)
    expect(clipboard).toContain(
      `filter.${REGION_FILTER_ID}=${REGION_FILTER_VALUE_A}`,
    )
  })

  test('back button does NOT unwind filter changes (replace mode)', async ({
    page,
  }) => {
    // Navigate home first so the dashboard is the SECOND history entry.
    await page.goto('/')
    await page.goto(
      `/dashboards/${sla.id}?filter.${REGION_FILTER_ID}=${REGION_FILTER_VALUE_A}`,
    )
    await waitForDashboardLoad(page, sla.name)

    // Wait for the bidirectional URL sync to settle.
    await page.waitForFunction(
      (expected: string) => window.location.search.includes(expected),
      `filter.${REGION_FILTER_ID}=${REGION_FILTER_VALUE_A}`,
      { timeout: 5_000 },
    )
    expect(page.url()).toContain(`/dashboards/${sla.id}`)

    // Back navigation: because filter writes use replace mode, the previous
    // history entry is `/` (the home page), NOT a previous filter state on
    // this dashboard.
    await page.goBack()
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).not.toContain(`/dashboards/${sla.id}`)
  })
})
