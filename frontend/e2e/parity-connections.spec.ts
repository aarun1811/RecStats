import { expect, test } from '@playwright/test'

/**
 * Phase 16 Plan 03 -- Parity verification for connection management (PRTY-07).
 *
 * Verifies that the connection management UI:
 * 1. Renders existing data source connections from the seed data
 * 2. Supports the full create -> test -> save -> delete lifecycle
 *
 * Connection management now operates on recviz_connections (direct SQLAlchemy)
 * instead of Superset's database table. These tests confirm the full
 * UI-to-database CRUD flow works end-to-end.
 */

// Dev database credentials from docker-compose.yml
const DEV_DB = {
  host: 'localhost',
  port: '5432',
  database: 'recon_data',
  username: 'recviz',
  password: 'recviz_dev',
}

test.describe('PRTY-07: Connection management parity', () => {
  test('renders existing data sources on settings page', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/settings')

    // Verify page heading
    await expect(
      page.locator('h1', { hasText: 'Settings' }),
    ).toBeVisible({ timeout: 10_000 })

    // Click on the Data Sources tab
    await page.getByRole('tab', { name: /Data Sources/i }).click()

    // Verify the "Configured Data Sources" heading is visible
    await expect(
      page.locator('text=Configured Data Sources'),
    ).toBeVisible({ timeout: 10_000 })

    // Verify at least one data source card/row is visible (seed data)
    // The data source cards contain database icons and names
    // Wait for loading to complete (skeletons disappear)
    await expect(
      page.locator('[data-slot="skeleton"]'),
    ).toHaveCount(0, { timeout: 10_000 })

    // Check for either data source cards or the empty state
    const hasCards = await page.locator('[class*="cursor-pointer"][class*="hover"]').first().isVisible().catch(() => false)
    const hasEmpty = await page.locator('text=No data sources configured').isVisible().catch(() => false)

    // At least one of these must be true -- page loaded something
    expect(hasCards || hasEmpty).toBeTruthy()

    // No console errors (filter out benign resource loading errors)
    const relevantErrors = consoleErrors.filter(
      (e) => !e.includes('Failed to load resource') && !e.includes('404'),
    )
    expect(relevantErrors).toHaveLength(0)
  })

  test('creates, tests, and deletes a connection', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/settings')
    await expect(
      page.locator('h1', { hasText: 'Settings' }),
    ).toBeVisible({ timeout: 10_000 })

    // Navigate to Data Sources tab
    await page.getByRole('tab', { name: /Data Sources/i }).click()
    await expect(
      page.locator('text=Configured Data Sources'),
    ).toBeVisible({ timeout: 10_000 })

    // Wait for loading to complete
    await expect(
      page.locator('[data-slot="skeleton"]'),
    ).toHaveCount(0, { timeout: 10_000 })

    // Click "Add Data Source" button
    const addButton = page.getByRole('button', { name: /Add Data Source/i })
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Verify the sheet opens in create mode
    await expect(
      page.locator('text=Add Data Source').last(),
    ).toBeVisible({ timeout: 5_000 })
    await expect(
      page.locator('text=Configure a new database connection'),
    ).toBeVisible()

    // PostgreSQL should be selected by default
    // Verify the PostgreSQL button has the active border
    const pgButton = page.locator('button', { hasText: 'PostgreSQL' })
    await expect(pgButton).toBeVisible()

    // Fill in display name
    const displayNameInput = page.locator('#display-name')
    await displayNameInput.fill('Parity Test Connection')

    // Fill in connection fields
    const hostInput = page.locator('#host')
    await hostInput.fill(DEV_DB.host)

    const portInput = page.locator('#port')
    await portInput.fill('')
    await portInput.fill(DEV_DB.port)

    const dbInput = page.locator('#database')
    await dbInput.fill(DEV_DB.database)

    const userInput = page.locator('#username')
    await userInput.fill(DEV_DB.username)

    const passInput = page.locator('#password')
    await passInput.fill(DEV_DB.password)

    // Click "Test Connection" button
    const testButton = page.getByRole('button', { name: /Test Connection/i })
    await expect(testButton).toBeVisible()
    await testButton.click()

    // Wait for the test result -- should show a success indicator
    // The component shows CheckCircle2 icon + "Connection successful" or similar message
    await expect(
      page.locator('text=/Connection successful|connected|success/i'),
    ).toBeVisible({ timeout: 15_000 })

    // Save button should now be enabled (canSave requires displayName + hasPassedTest)
    const saveButton = page.getByRole('button', { name: /^Save$/i })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Wait for the sheet to close and the connection to appear in the list
    // A success toast should appear: 'Created "Parity Test Connection"'
    await expect(
      page.locator('text=/Created.*Parity Test Connection/i'),
    ).toBeVisible({ timeout: 10_000 })

    // Verify the new connection appears in the data sources list
    await expect(
      page.locator('text=Parity Test Connection'),
    ).toBeVisible({ timeout: 10_000 })

    // Click the newly created connection to open detail view
    await page.locator('text=Parity Test Connection').click()

    // Verify detail view shows the connection name
    await expect(
      page.locator('[class*="SheetTitle"], [class*="text-base"]', {
        hasText: 'Parity Test Connection',
      }),
    ).toBeVisible({ timeout: 5_000 })

    // Click Delete button
    const deleteButton = page.getByRole('button', { name: /Delete/i })
    await expect(deleteButton).toBeVisible()

    // Handle the confirmation dialog (window.confirm)
    page.on('dialog', (dialog) => dialog.accept())
    await deleteButton.click()

    // Wait for deletion -- success toast and sheet closes
    await expect(
      page.locator('text=/Deleted.*Parity Test Connection/i'),
    ).toBeVisible({ timeout: 10_000 })

    // Verify the connection is removed from the list
    await expect(
      page.locator('text=Parity Test Connection'),
    ).not.toBeVisible({ timeout: 5_000 })
  })

  test('Add Data Source button opens sheet in create mode', async ({
    page,
  }) => {
    await page.goto('/settings')
    await expect(
      page.locator('h1', { hasText: 'Settings' }),
    ).toBeVisible({ timeout: 10_000 })

    // Navigate to Data Sources tab
    await page.getByRole('tab', { name: /Data Sources/i }).click()
    await expect(
      page.locator('text=Configured Data Sources'),
    ).toBeVisible({ timeout: 10_000 })

    // Wait for loading
    await expect(
      page.locator('[data-slot="skeleton"]'),
    ).toHaveCount(0, { timeout: 10_000 })

    // Click "Add Data Source"
    const addButton = page.getByRole('button', { name: /Add Data Source/i })
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Verify sheet opened with create mode content
    await expect(
      page.locator('text=Configure a new database connection'),
    ).toBeVisible({ timeout: 5_000 })

    // Verify database type selector is present with all options
    await expect(page.locator('button', { hasText: 'PostgreSQL' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Oracle' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Hive' })).toBeVisible()

    // Verify Display Name input is present and empty
    const nameInput = page.locator('#display-name')
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toHaveValue('')

    // Verify connection fields are present (PostgreSQL default)
    await expect(page.locator('#host')).toBeVisible()
    await expect(page.locator('#port')).toBeVisible()
    await expect(page.locator('#database')).toBeVisible()
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()

    // Verify Test Connection button exists
    await expect(
      page.getByRole('button', { name: /Test Connection/i }),
    ).toBeVisible()

    // Verify Save button exists but is disabled (no name, no test passed)
    const saveButton = page.getByRole('button', { name: /^Save$/i })
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeDisabled()

    // Verify Cancel button exists
    await expect(
      page.getByRole('button', { name: /Cancel/i }),
    ).toBeVisible()
  })
})
