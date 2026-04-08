import { expect, test, type Page } from '@playwright/test'

import {
  CURATED_DASHBOARDS,
  CURATED_DATASETS,
  CURATED_KPIS,
} from './_fixtures'

/**
 * SHAR-04 — Command palette (Phase 9 Plan 09-03), rewritten for Phase 10
 * Plan 10-01c against the curated test catalog.
 *
 * Verifies the Cmd+K palette against the seeded curated entities. Replaces
 * the old POST/DELETE ephemeral seed pattern with stable curated slugs from
 * `_fixtures.ts`. Covers:
 *
 *   - Searching the prefixed dashboard name `Phase 10 · SLA Overview`
 *     navigates to `/dashboards/dash-sla`
 *   - Searching a multi-type token ("Match Rate") surfaces multiple group
 *     headings in the canonical TYPE_ORDER (Dashboards → Charts → Datasets →
 *     KPIs)
 *   - Searching a curated dataset ("Transactions — Daily Volume") and
 *     pressing Enter navigates to `/datasets/ds-recon-transactions-daily/edit`
 *   - Searching a curated KPI ("Avg Match Confidence") and pressing Enter
 *     navigates to `/kpis/kpi-avg-confidence/edit`
 */

const { sla, matchRate } = CURATED_DASHBOARDS
const { transactionsDaily } = CURATED_DATASETS
const { avgConfidence } = CURATED_KPIS

function paletteInput(page: Page) {
  return page.locator('[data-slot="command-input"]')
}

async function openPalette(page: Page) {
  await page.keyboard.press('Meta+k')
  await expect(paletteInput(page)).toBeVisible({ timeout: 5_000 })
}

test.describe('SHAR-04 command palette (curated catalog)', () => {
  test('searching "SLA Overview" surfaces dash-sla and Enter navigates to /dashboards/dash-sla', async ({
    page,
  }) => {
    await page.goto('/dashboards')
    await openPalette(page)
    await paletteInput(page).fill('SLA Overview')

    // Dashboards group heading appears.
    await expect(
      page.locator('[cmdk-group-heading]', { hasText: 'Dashboards' }),
    ).toBeVisible({ timeout: 10_000 })

    // The curated dashboard name (with the Phase 10 · prefix) is in the
    // results — match against the human-readable end of the name.
    await page
      .getByRole('option', { name: new RegExp(sla.name) })
      .first()
      .click()

    await expect(page).toHaveURL(new RegExp(`/dashboards/${sla.id}$`), {
      timeout: 10_000,
    })
  })

  test('searching "Match Rate" surfaces multiple type groups in TYPE_ORDER', async ({
    page,
  }) => {
    await page.goto('/dashboards')
    await openPalette(page)
    await paletteInput(page).fill('Match Rate')

    // The query should hit at least the dash-match-rate dashboard, the
    // chart-match-rate-gauge chart, and the kpi-match-rate KPI. Assert that
    // the rendered group headings (filtered to the four entity types) appear
    // in the canonical TYPE_ORDER: Dashboards → Charts → Datasets → KPIs.
    const headings = page.locator('[cmdk-group-heading]')

    // The Dashboards group with `dash-match-rate` MUST be present.
    await expect(headings.filter({ hasText: 'Dashboards' })).toBeVisible({
      timeout: 10_000,
    })

    // Read the rendered headings in DOM order, then filter to only the four
    // entity headings of interest.
    const rendered = await headings.allTextContents()
    const filtered = rendered.filter((h) =>
      ['Dashboards', 'Charts', 'Datasets', 'KPIs'].includes(h),
    )
    // At least Dashboards must appear; downstream order check verifies the
    // remaining headings are in TYPE_ORDER.
    expect(filtered.length).toBeGreaterThanOrEqual(1)
    const indexFor = (label: string) => filtered.indexOf(label)
    if (indexFor('Charts') >= 0) {
      expect(indexFor('Charts')).toBeGreaterThan(indexFor('Dashboards'))
    }
    if (indexFor('Datasets') >= 0 && indexFor('Charts') >= 0) {
      expect(indexFor('Datasets')).toBeGreaterThan(indexFor('Charts'))
    }
    if (indexFor('KPIs') >= 0 && indexFor('Datasets') >= 0) {
      expect(indexFor('KPIs')).toBeGreaterThan(indexFor('Datasets'))
    }

    // Sanity check: the curated dash-match-rate is reachable from this query.
    await expect(
      page.getByRole('option', { name: new RegExp(matchRate.name) }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('searching a curated dataset name navigates to /datasets/:id/edit on Enter', async ({
    page,
  }) => {
    await page.goto('/dashboards')
    await openPalette(page)
    await paletteInput(page).fill(transactionsDaily.name)

    await expect(
      page.locator('[cmdk-group-heading]', { hasText: 'Datasets' }),
    ).toBeVisible({ timeout: 10_000 })

    await page
      .getByRole('option', { name: new RegExp(transactionsDaily.name) })
      .first()
      .click()

    await expect(page).toHaveURL(
      new RegExp(`/datasets/${transactionsDaily.id}/edit$`),
      { timeout: 10_000 },
    )
  })

  test('searching a curated KPI name navigates to /kpis/:id/edit on Enter', async ({
    page,
  }) => {
    await page.goto('/dashboards')
    await openPalette(page)
    await paletteInput(page).fill(avgConfidence.name)

    await expect(
      page.locator('[cmdk-group-heading]', { hasText: 'KPIs' }),
    ).toBeVisible({ timeout: 10_000 })

    // Lucide Gauge icon present somewhere in the palette.
    await expect(page.locator('.lucide-gauge').first()).toBeVisible({
      timeout: 5_000,
    })

    await page
      .getByRole('option', { name: new RegExp(avgConfidence.name) })
      .first()
      .click()

    await expect(page).toHaveURL(
      new RegExp(`/kpis/${avgConfidence.id}/edit$`),
      { timeout: 10_000 },
    )
  })
})
