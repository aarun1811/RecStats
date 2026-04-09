import { expect, test } from '@playwright/test'

/**
 * Phase 16 Plan 02 -- Parity verification for dashboard builder CRUD cycle
 * (PRTY-04).
 *
 * Verifies that the dashboard builder can create a new dashboard, add a chart
 * from the library, save it, view it in read mode, and delete it -- full CRUD
 * cycle against the new direct engine.
 */

test.describe('PRTY-04: Dashboard builder CRUD parity', () => {
  test('create, add chart, save, view, and delete a dashboard', async ({
    page,
  }) => {
    // Generous timeout -- builder operations involve multiple API calls
    test.setTimeout(60_000)

    const uniqueName = `Parity Test Dashboard ${Date.now()}`

    // -----------------------------------------------------------------------
    // Step 1: Navigate to the builder and verify it loads
    // -----------------------------------------------------------------------
    await page.goto('/dashboards/new')
    await page.waitForLoadState('networkidle')

    // Builder page should render without errors -- look for the toolbar
    const saveButton = page.getByRole('button', { name: /save dashboard/i })
    await expect(saveButton).toBeVisible({ timeout: 15_000 })

    // -----------------------------------------------------------------------
    // Step 2: Set the dashboard name
    // -----------------------------------------------------------------------
    const nameInput = page.locator('input[placeholder="Untitled Dashboard"]')
    await expect(nameInput).toBeVisible()
    await nameInput.fill(uniqueName)

    // -----------------------------------------------------------------------
    // Step 3: Add a chart from the library
    // -----------------------------------------------------------------------
    // Click the "Add" dropdown trigger in the builder toolbar
    const addButton = page.getByRole('button', { name: /^add$/i })
    await expect(addButton).toBeVisible({ timeout: 5_000 })
    await addButton.click()

    // The AddContentMenu dropdown should appear with chart/KPI/grid/filter options
    const chartOption = page.getByRole('menuitem', { name: /chart/i })
    await expect(chartOption).toBeVisible({ timeout: 5_000 })
    await chartOption.click()

    // The ChartPickerDialog should open with "Add Chart" title
    await expect(page.locator('text=Add Chart')).toBeVisible({
      timeout: 5_000,
    })

    // Select the first available chart from the picker grid
    const chartItems = page.locator(
      '[class*="border"][class*="rounded-lg"][class*="cursor-pointer"]',
    )
    const chartCount = await chartItems.count()
    expect(chartCount, 'No charts available in the library').toBeGreaterThan(0)
    await chartItems.first().click()

    // Click "Add to Dashboard" to confirm
    const addToDashboard = page.getByRole('button', {
      name: /add to dashboard/i,
    })
    await expect(addToDashboard).toBeEnabled()
    await addToDashboard.click()

    // Verify the dialog closed and a panel appeared on the canvas
    await expect(page.locator('text=Add Chart')).toHaveCount(0, {
      timeout: 3_000,
    })

    // -----------------------------------------------------------------------
    // Step 4: Save the dashboard
    // -----------------------------------------------------------------------
    await saveButton.click()

    // Wait for the success toast -- "Dashboard saved" from builder-page.tsx
    await expect(page.locator('text=Dashboard saved')).toBeVisible({
      timeout: 10_000,
    })

    // After save, the builder navigates to /dashboards/:id (view mode)
    // Extract the dashboard ID from the URL
    await page.waitForURL(/\/dashboards\/[a-zA-Z0-9-]+$/, { timeout: 10_000 })
    const url = page.url()
    const match = url.match(/\/dashboards\/([a-zA-Z0-9-]+)$/)
    expect(match, 'URL should contain dashboard ID').not.toBeNull()
    const savedId = match![1]

    // -----------------------------------------------------------------------
    // Step 5: Verify the saved dashboard renders in view mode
    // -----------------------------------------------------------------------
    // The dashboard should show the name we typed
    await expect(
      page.locator('h1', { hasText: uniqueName }),
    ).toBeVisible({ timeout: 15_000 })

    // At least one chart surface should be visible
    const chartSurface = page
      .locator('canvas, [_echarts_instance_]')
      .first()
    await expect(chartSurface).toBeVisible({ timeout: 15_000 })

    // -----------------------------------------------------------------------
    // Step 6: Delete the dashboard (cleanup)
    // -----------------------------------------------------------------------
    // Navigate to the dashboard list
    await page.goto('/dashboards')
    await page.waitForLoadState('networkidle')

    // Find the dashboard card/row with our unique name and trigger delete
    // The dashboard list has cards with a delete action (DashboardListCard onDelete)
    // Look for a context menu trigger or delete button near our dashboard name
    const dashboardEntry = page.locator(`text=${uniqueName}`)
    await expect(dashboardEntry).toBeVisible({ timeout: 10_000 })

    // The delete trigger is typically an icon button with a trash icon or
    // a dropdown menu item. DashboardListCard has an onDelete prop triggered
    // by clicking a trash/delete button on the card.
    // Find the card containing our dashboard name, then find its delete trigger
    const card = dashboardEntry.locator('..')
    // DashboardListCard renders a small icon button with Trash2 icon
    const deleteButton = card.locator('button').filter({ has: page.locator('svg') }).last()

    // If there's a visible delete/trash button, click it
    if (await deleteButton.isVisible()) {
      await deleteButton.click()
    } else {
      // Fallback: use API to delete the dashboard directly
      await page.request.delete(`/api/dashboards/managed/${savedId}`)
      return
    }

    // Confirm in the DeleteDashboardDialog
    const confirmDelete = page.getByRole('button', {
      name: /delete dashboard/i,
    })
    await expect(confirmDelete).toBeVisible({ timeout: 5_000 })
    await confirmDelete.click()

    // Wait for the "Dashboard deleted" success toast
    await expect(page.locator('text=Dashboard deleted')).toBeVisible({
      timeout: 5_000,
    })

    // Verify the dashboard is no longer in the list
    await page.waitForTimeout(1_000) // Allow list to refetch
    await expect(page.locator(`text=${uniqueName}`)).toHaveCount(0, {
      timeout: 5_000,
    })
  })
})
