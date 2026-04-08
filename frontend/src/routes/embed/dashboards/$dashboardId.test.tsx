// @vitest-environment jsdom
/**
 * SHAR-03 — Embed route hook upgrade + `?hide=` token integration tests.
 *
 * Wave 0 RED: these tests fail until Tasks 2, 3, and 4 land (EmbedTopbar.hideTitle,
 * DashboardRenderer.hideFilterBar/hideToolbar, and the embed route rewrite).
 *
 * Scope: wiring-level assertions that the embed route
 *   1. Uses `useManagedDashboard` (NOT the legacy `useDashboardConfig`)
 *   2. Reads the URL search params via `parseFilterParams` / `parseLockedFilters` /
 *      `parseHideTokens` from `lib/dashboard-url-state`
 *   3. Forwards `hideTitle` to `<EmbedTopbar>` (tested with `?hide=title`)
 *   4. Forwards `hideFilterBar` to `<DashboardRenderer>` (tested with `?hide=filter-bar`)
 *   5. Forwards `hideToolbar` to `<DashboardRenderer>` (tested with `?hide=toolbar`)
 *
 * The full-render / network / cross-filter behaviors are covered by
 * `frontend/e2e/embed.spec.ts` (real-API Playwright per project memory
 * `feedback_no_mock_shortcuts.md`).
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

// --- Mocks ------------------------------------------------------------------

// Mock `useManagedDashboard` — the target hook. Test 1 asserts the embed route
// module references this hook by source text. The other tests read the mock
// value via `mockReturnValue` below.
const useManagedDashboardMock = vi.fn()
vi.mock('@/hooks/use-managed-dashboards', () => ({
  useManagedDashboard: (id: string | null) => useManagedDashboardMock(id),
}))

// Mock the legacy hook so we can assert it is NOT called (safety net).
const useDashboardConfigMock = vi.fn()
vi.mock('@/hooks/use-dashboard-config', () => ({
  useDashboardConfig: (id: string | null) => useDashboardConfigMock(id),
}))

// Mock the theme provider — the embed route calls `setTheme(...)` when a
// `?theme=` param is present. Test 2 asserts this contract.
const setThemeMock = vi.fn()
vi.mock('@/components/layout/theme-provider', () => ({
  useTheme: () => ({ theme: 'light', setTheme: setThemeMock }),
}))

// Mock TanStack Router's createFileRoute — we bypass route creation and
// directly construct the component via a lightweight shim. This avoids
// having to build a full RouterProvider tree for a wiring test.
const mockUseParams = vi.fn(() => ({ dashboardId: 'test-id' }))
const mockUseSearch = vi.fn(() => ({}) as Record<string, unknown>)
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (opts: Record<string, unknown>) => ({
    ...opts,
    useParams: mockUseParams,
    useSearch: mockUseSearch,
  }),
}))

// Mock the renderer — the spy captures the props passed in so the test can
// assert that hide flags and initialFilters arrive correctly.
const dashboardRendererSpy = vi.fn()
vi.mock('@/components/dashboard/dashboard-renderer', () => ({
  DashboardRenderer: (props: Record<string, unknown>) => {
    dashboardRendererSpy(props)
    return <div data-testid="dashboard-renderer-mock" />
  },
}))

// Mock EmbedTopbar — same pattern, spy on props.
const embedTopbarSpy = vi.fn()
vi.mock('@/components/embed/embed-topbar', () => ({
  EmbedTopbar: (props: Record<string, unknown>) => {
    embedTopbarSpy(props)
    return <div data-testid="embed-topbar-mock" />
  },
}))

// Skeleton passthrough
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: Record<string, unknown>) => (
    <div data-testid="skeleton-mock" {...props} />
  ),
}))

// --- Fixtures ---------------------------------------------------------------

function managedDashboardFixture() {
  return {
    id: 'test-id',
    name: 'Embed Test Dashboard',
    description: '',
    config: {
      id: 'test-id',
      name: 'Embed Test Dashboard',
      description: '',
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
        },
      ],
      kpis: [],
      charts: [],
      grids: [],
      layout: { type: 'stack', sections: [] },
    },
    createdAt: '2026-04-08T00:00:00Z',
    updatedAt: '2026-04-08T00:00:00Z',
  }
}

// Helper: import the route component fresh after resetting mocks / search
// params. Avoids stale mocks between tests.
async function importEmbedPage() {
  // Import the module — because it uses vi.mock, we get the mocked version.
  const mod = await import('./$dashboardId')
  // The createFileRoute shim wraps the options object; pull out component.
  const route = mod.Route as unknown as {
    component: () => JSX.Element
  }
  return route.component
}

// --- Tests ------------------------------------------------------------------

describe('Embed route — Phase 9 hook upgrade + hide tokens', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    embedTopbarSpy.mockClear()
    dashboardRendererSpy.mockClear()
    setThemeMock.mockClear()
    useManagedDashboardMock.mockReset()
    useDashboardConfigMock.mockReset()
    mockUseParams.mockReturnValue({ dashboardId: 'test-id' })
    mockUseSearch.mockReturnValue({})
    vi.resetModules()
  })

  test('reads dashboard from useManagedDashboard (not useDashboardConfig)', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: managedDashboardFixture(),
      isLoading: false,
    })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(useManagedDashboardMock).toHaveBeenCalledWith('test-id')
    expect(useDashboardConfigMock).not.toHaveBeenCalled()
  })

  test('applies theme via setTheme when ?theme=dark', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: managedDashboardFixture(),
      isLoading: false,
    })
    mockUseSearch.mockReturnValue({ theme: 'dark' })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(setThemeMock).toHaveBeenCalledWith('dark')
  })

  test('passes parsed initialFilters to DashboardRenderer when ?filter.region=APAC', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: managedDashboardFixture(),
      isLoading: false,
    })
    mockUseSearch.mockReturnValue({ 'filter.region': 'APAC' })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(dashboardRendererSpy).toHaveBeenCalled()
    const rendererProps = dashboardRendererSpy.mock.calls.at(-1)![0]
    expect(rendererProps.initialFilters).toEqual({ region: 'APAC' })
  })

  test('passes parsed lockedFilters to DashboardRenderer when ?filter.lock=region,product', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: managedDashboardFixture(),
      isLoading: false,
    })
    mockUseSearch.mockReturnValue({ 'filter.lock': 'region,product' })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(dashboardRendererSpy).toHaveBeenCalled()
    const rendererProps = dashboardRendererSpy.mock.calls.at(-1)![0]
    expect(rendererProps.lockedFilters).toEqual(['region', 'product'])
  })

  test('passes hideTitle=true to EmbedTopbar when ?hide=title', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: managedDashboardFixture(),
      isLoading: false,
    })
    mockUseSearch.mockReturnValue({ hide: 'title' })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(embedTopbarSpy).toHaveBeenCalled()
    const topbarProps = embedTopbarSpy.mock.calls.at(-1)![0]
    expect(topbarProps.hideTitle).toBe(true)
  })

  test('passes hideFilterBar=true and hideToolbar=true to DashboardRenderer when ?hide=filter-bar,toolbar', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: managedDashboardFixture(),
      isLoading: false,
    })
    mockUseSearch.mockReturnValue({ hide: 'filter-bar,toolbar' })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(dashboardRendererSpy).toHaveBeenCalled()
    const rendererProps = dashboardRendererSpy.mock.calls.at(-1)![0]
    expect(rendererProps.hideFilterBar).toBe(true)
    expect(rendererProps.hideToolbar).toBe(true)
  })

  test('renders skeleton (no topbar/renderer) while isLoading', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(screen.queryAllByTestId('skeleton-mock').length).toBeGreaterThan(0)
    expect(embedTopbarSpy).not.toHaveBeenCalled()
    expect(dashboardRendererSpy).not.toHaveBeenCalled()
  })

  test('renders "Dashboard not found" fallback when dashboard is undefined and not loading', async () => {
    useManagedDashboardMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    const EmbedPage = await importEmbedPage()
    render(<EmbedPage />)

    expect(screen.getByText('Dashboard not found')).toBeInTheDocument()
  })
})
