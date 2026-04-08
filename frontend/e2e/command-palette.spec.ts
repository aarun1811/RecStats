import { expect, test } from '@playwright/test'

/**
 * SHAR-04 — Command palette rewrite (Phase 9 Plan 09-03)
 *
 * Verifies the Cmd+K command palette against the REAL backend (no mocks per
 * `feedback_no_mock_shortcuts.md`). Covers:
 *
 *   - Baseline: palette opens via Cmd+K; placeholder reads
 *     "Search dashboards, charts, datasets, KPIs..."
 *   - Result per type: dashboard, chart, dataset, KPI all render with the
 *     correct group heading and icon
 *   - Route navigation (D-17 bug fixes):
 *       dashboard → /dashboards/{id}
 *       chart     → /charts/{id}/edit   (was /dashboards/{id})
 *       dataset   → /datasets/{id}/edit (was /explorer)
 *       kpi       → /kpis/{id}/edit     (NEW)
 *   - Group ordering: Dashboards → Charts → Datasets → KPIs (per D-15)
 *
 * Each test seeds real entities via POST to the managed endpoints and cleans
 * up in a ``finally`` block. Multi-entity tests share a seeded dataset so the
 * chart and KPI can FK to it.
 */

const BACKEND_URL = 'http://localhost:8000'

interface SeededDashboard {
  id: string
  name: string
}
interface SeededDataset {
  id: string
  name: string
}
interface SeededChart {
  id: string
  name: string
}
interface SeededKpi {
  id: string
  name: string
}

async function seedDashboard(
  request: import('@playwright/test').APIRequestContext,
  tag: string,
): Promise<SeededDashboard> {
  const name = `rv-09-03-dash-${tag}-${Date.now()}`
  const config = {
    id: 'temp',
    name,
    description: 'Plan 09-03 palette spec seed',
    features: { crossFilter: false, drillDown: false },
    filters: [],
    kpis: [],
    charts: [],
    grids: [],
    layout: { type: 'stack', sections: [] },
  }
  const res = await request.post(`${BACKEND_URL}/api/dashboards/managed`, {
    data: { name, description: 'Plan 09-03 palette spec seed', config },
  })
  expect(
    res.status(),
    `seed dashboard create failed: ${await res.text()}`,
  ).toBe(201)
  const body = await res.json()
  return { id: body.id as string, name }
}

async function seedDataset(
  request: import('@playwright/test').APIRequestContext,
  tag: string,
): Promise<SeededDataset> {
  const name = `rv-09-03-ds-${tag}-${Date.now()}`
  const res = await request.post(`${BACKEND_URL}/api/datasets/managed`, {
    data: {
      name,
      description: 'Plan 09-03 palette spec seed',
      databaseId: 1,
      sql: 'SELECT 1 AS amount',
      columns: [
        {
          name: 'amount',
          displayName: 'Amount',
          dataType: 'number',
          role: 'measure',
          aggregation: 'SUM',
          formatPreset: 'none',
          formatString: '',
        },
      ],
    },
  })
  expect(
    res.status(),
    `seed dataset create failed: ${await res.text()}`,
  ).toBe(201)
  const body = await res.json()
  return { id: body.id as string, name }
}

async function seedChart(
  request: import('@playwright/test').APIRequestContext,
  datasetId: string,
  tag: string,
): Promise<SeededChart> {
  const name = `rv-09-03-chart-${tag}-${Date.now()}`
  const res = await request.post(`${BACKEND_URL}/api/charts/managed`, {
    data: {
      name,
      description: 'Plan 09-03 palette spec seed',
      datasetId,
      chartType: 'bar',
      config: {
        columnMapping: {
          categoryColumn: 'amount',
          metricColumns: ['amount'],
          aggregations: { amount: 'SUM' },
        },
        appearance: {
          title: 'Seeded chart',
          showLegend: true,
          legendPosition: 'bottom',
          showXLabel: true,
          showYLabel: true,
        },
      },
    },
  })
  expect(
    res.status(),
    `seed chart create failed: ${await res.text()}`,
  ).toBe(201)
  const body = await res.json()
  return { id: body.id as string, name }
}

async function seedKpi(
  request: import('@playwright/test').APIRequestContext,
  datasetId: string,
  tag: string,
): Promise<SeededKpi> {
  const name = `rv-09-03-kpi-${tag}-${Date.now()}`
  const res = await request.post(`${BACKEND_URL}/api/kpis/managed`, {
    data: {
      name,
      description: 'Plan 09-03 palette spec seed',
      datasetId,
      metricColumn: 'amount',
      aggregation: 'SUM',
      config: {
        format: {
          type: 'number',
          decimals: null,
          abbreviate: true,
          currencyCode: null,
        },
        trend: null,
        thresholds: null,
        subtitle: '',
      },
    },
  })
  expect(res.status(), `seed KPI create failed: ${await res.text()}`).toBe(201)
  const body = await res.json()
  return { id: body.id as string, name }
}

async function deleteDashboard(
  request: import('@playwright/test').APIRequestContext,
  id: string,
) {
  await request.delete(`${BACKEND_URL}/api/dashboards/managed/${id}`)
}
async function deleteChart(
  request: import('@playwright/test').APIRequestContext,
  id: string,
) {
  await request.delete(`${BACKEND_URL}/api/charts/managed/${id}`)
}
async function deleteKpi(
  request: import('@playwright/test').APIRequestContext,
  id: string,
) {
  await request.delete(`${BACKEND_URL}/api/kpis/managed/${id}`)
}
async function deleteDataset(
  request: import('@playwright/test').APIRequestContext,
  id: string,
) {
  await request.delete(`${BACKEND_URL}/api/datasets/managed/${id}`)
}

/**
 * Open the command palette via Cmd+K (macOS) / Ctrl+K (other). Playwright on
 * Chromium fires `Meta+k` and `Control+k` identically — the palette's
 * keyboard handler checks both `metaKey` and `ctrlKey`, so either works.
 */
/**
 * Locate the palette CommandInput specifically (not the header search input
 * which also has a "Search dashboards..." placeholder). The Shadcn Command
 * primitive emits `data-slot="command-input"` on its input element.
 */
function paletteInput(page: import('@playwright/test').Page) {
  return page.locator('[data-slot="command-input"]')
}

async function openPalette(page: import('@playwright/test').Page) {
  await page.keyboard.press('Meta+k')
  await expect(paletteInput(page)).toBeVisible({ timeout: 5_000 })
}

test.describe('SHAR-04 command palette', () => {
  test('placeholder text includes KPIs', async ({ page, request }) => {
    // Seed one entity so the palette is reachable from a non-empty page
    const dashboard = await seedDashboard(request, 'placeholder')
    try {
      await page.goto('/dashboards')
      await openPalette(page)
      await expect(paletteInput(page)).toHaveAttribute(
        'placeholder',
        'Search dashboards, charts, datasets, KPIs...',
      )
    } finally {
      await deleteDashboard(request, dashboard.id)
    }
  })

  test('dashboard result renders under "Dashboards" and navigates to /dashboards/:id', async ({
    page,
    request,
  }) => {
    const dashboard = await seedDashboard(request, 'nav')
    try {
      await page.goto('/dashboards')
      await openPalette(page)
      await paletteInput(page).fill(dashboard.name)

      // Wait for the group heading to appear
      await expect(
        page.locator('[cmdk-group-heading]', { hasText: 'Dashboards' }),
      ).toBeVisible({ timeout: 10_000 })

      // Click the result row
      await page
        .getByRole('option', { name: new RegExp(dashboard.name) })
        .first()
        .click()

      await expect(page).toHaveURL(
        new RegExp(`/dashboards/${dashboard.id}$`),
        { timeout: 10_000 },
      )
    } finally {
      await deleteDashboard(request, dashboard.id)
    }
  })

  test('chart result navigates to /charts/:id/edit (fix for existing bug)', async ({
    page,
    request,
  }) => {
    const dataset = await seedDataset(request, 'chart-nav')
    let chart: SeededChart | null = null
    try {
      chart = await seedChart(request, dataset.id, 'nav')
      await page.goto('/dashboards')
      await openPalette(page)
      await paletteInput(page).fill(chart.name)

      await expect(
        page.locator('[cmdk-group-heading]', { hasText: 'Charts' }),
      ).toBeVisible({ timeout: 10_000 })

      await page
        .getByRole('option', { name: new RegExp(chart.name) })
        .first()
        .click()

      await expect(page).toHaveURL(
        new RegExp(`/charts/${chart.id}/edit$`),
        { timeout: 10_000 },
      )
    } finally {
      if (chart) await deleteChart(request, chart.id)
      await deleteDataset(request, dataset.id)
    }
  })

  test('dataset result navigates to /datasets/:id/edit (fix for existing bug)', async ({
    page,
    request,
  }) => {
    const dataset = await seedDataset(request, 'ds-nav')
    try {
      await page.goto('/dashboards')
      await openPalette(page)
      await paletteInput(page).fill(dataset.name)

      await expect(
        page.locator('[cmdk-group-heading]', { hasText: 'Datasets' }),
      ).toBeVisible({ timeout: 10_000 })

      await page
        .getByRole('option', { name: new RegExp(dataset.name) })
        .first()
        .click()

      await expect(page).toHaveURL(
        new RegExp(`/datasets/${dataset.id}/edit$`),
        { timeout: 10_000 },
      )
    } finally {
      await deleteDataset(request, dataset.id)
    }
  })

  test('KPI result renders under "KPIs" with Gauge icon and navigates to /kpis/:id/edit', async ({
    page,
    request,
  }) => {
    const dataset = await seedDataset(request, 'kpi-nav')
    let kpi: SeededKpi | null = null
    try {
      kpi = await seedKpi(request, dataset.id, 'nav')
      await page.goto('/dashboards')
      await openPalette(page)
      await paletteInput(page).fill(kpi.name)

      // KPI group heading present
      await expect(
        page.locator('[cmdk-group-heading]', { hasText: 'KPIs' }),
      ).toBeVisible({ timeout: 10_000 })

      // Gauge icon from lucide-react renders with the `lucide-gauge` class
      // applied by lucide's React wrapper. Verify at least one gauge icon
      // sits inside the palette.
      await expect(page.locator('.lucide-gauge').first()).toBeVisible({
        timeout: 5_000,
      })

      await page
        .getByRole('option', { name: new RegExp(kpi.name) })
        .first()
        .click()

      await expect(page).toHaveURL(
        new RegExp(`/kpis/${kpi.id}/edit$`),
        { timeout: 10_000 },
      )
    } finally {
      if (kpi) await deleteKpi(request, kpi.id)
      await deleteDataset(request, dataset.id)
    }
  })

  test('results are grouped in order: Dashboards → Charts → Datasets → KPIs', async ({
    page,
    request,
  }) => {
    // Seed one of each type whose names share a common token
    const token = `xgrouporder${Date.now()}`
    const dashboard = await seedDashboard(request, token)
    const dataset = await seedDataset(request, token)
    let chart: SeededChart | null = null
    let kpi: SeededKpi | null = null
    try {
      chart = await seedChart(request, dataset.id, token)
      kpi = await seedKpi(request, dataset.id, token)

      await page.goto('/dashboards')
      await openPalette(page)
      await paletteInput(page).fill(token)

      // All four headings should render
      const headings = page.locator('[cmdk-group-heading]')
      await expect(headings.filter({ hasText: 'Dashboards' })).toBeVisible({
        timeout: 10_000,
      })
      await expect(headings.filter({ hasText: 'Charts' })).toBeVisible()
      await expect(headings.filter({ hasText: 'Datasets' })).toBeVisible()
      await expect(headings.filter({ hasText: 'KPIs' })).toBeVisible()

      // Order check: read the rendered headings in DOM order and assert the
      // four entity headings appear in the expected sequence. The palette
      // may also render "Recent Searches" and sidebar nav headings — we
      // filter to only the four type headings for this assertion.
      const rendered = await headings.allTextContents()
      const filtered = rendered.filter((h) =>
        ['Dashboards', 'Charts', 'Datasets', 'KPIs'].includes(h),
      )
      expect(filtered).toEqual(['Dashboards', 'Charts', 'Datasets', 'KPIs'])
    } finally {
      if (kpi) await deleteKpi(request, kpi.id)
      if (chart) await deleteChart(request, chart.id)
      await deleteDataset(request, dataset.id)
      await deleteDashboard(request, dashboard.id)
    }
  })
})
