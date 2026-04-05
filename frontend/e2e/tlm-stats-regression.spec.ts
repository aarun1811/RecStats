import { test, expect } from '@playwright/test'

/**
 * TLM Stats Dashboard - Regression Tests
 *
 * Validates that the existing tlm-stats dashboard continues to work correctly
 * after the Phase 2.1 column mapping refactor. These tests ensure that the
 * refactor to config-driven column resolution does not regress existing
 * production dashboard configurations (D-15).
 */
test.describe('TLM Stats Dashboard - Regression', () => {
  test('dashboard loads and renders without column mapping errors', async ({ page }) => {
    await page.goto('/dashboards/tlm-stats')

    // Wait for the dashboard to load -- the filter bar or dashboard title should appear
    await page
      .locator('text=TLM Statistics')
      .or(page.locator('text=TLM Instance'))
      .waitFor({ state: 'visible', timeout: 15_000 })

    // The dashboard has filters that must be applied before charts load.
    // At this point, verify no column mapping errors are showing.
    // Charts may show "No data" if filters aren't applied -- that's OK.
    // The critical assertion is that no column mapping errors appear from
    // the refactored buildSeries/toChartConfig logic.
    await expect(page.locator('text=Column mapping error')).toHaveCount(0)
    await expect(page.locator('text=Unsupported chart type')).toHaveCount(0)
  })

  test('applying filters loads chart data without errors', async ({ page }) => {
    await page.goto('/dashboards/tlm-stats')

    // Wait for filter bar to appear
    await page
      .locator('text=TLM Instance')
      .waitFor({ state: 'visible', timeout: 15_000 })

    // The default filter value should be "TLMP_CONSUMER" (from config default_value).
    // Click the Apply/Go button to trigger data fetch.
    const applyBtn = page
      .locator('button:has-text("Apply")')
      .or(page.locator('button:has-text("Go")'))
    if (await applyBtn.isVisible()) {
      await applyBtn.click()
    }

    // Allow time for backend query execution
    await page.waitForTimeout(3_000)

    // Verify no column mapping errors appeared after filter application and data load
    await expect(page.locator('text=Column mapping error')).toHaveCount(0)
    await expect(page.locator('text=Unsupported chart type')).toHaveCount(0)
  })
})
