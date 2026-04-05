import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for RecViz chart rendering validation.
 *
 * Prerequisites: The full stack must be running before tests execute:
 *   1. Docker Compose (PostgreSQL + Redis)
 *   2. Apache Superset (query engine)
 *   3. FastAPI backend (uvicorn)
 *   4. Frontend dev server (auto-started by webServer config below, or reused if already running)
 *
 * Run: npx playwright test --reporter=list
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
