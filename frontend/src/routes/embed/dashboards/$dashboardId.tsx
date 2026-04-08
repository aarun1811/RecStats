import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { EmbedTopbar } from '@/components/embed/embed-topbar'
import { useTheme } from '@/components/layout/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagedDashboard } from '@/hooks/use-managed-dashboards'
import {
  parseFilterParams,
  parseHideTokens,
  parseLockedFilters,
} from '@/lib/dashboard-url-state'

export const Route = createFileRoute('/embed/dashboards/$dashboardId')({
  component: EmbedDashboardPage,
  // Permissive validateSearch — per-key parsing lives in
  // `lib/dashboard-url-state.ts`. Matches the view route convention.
  validateSearch: (search: Record<string, unknown>) => search,
})

function EmbedDashboardPage() {
  const { dashboardId } = Route.useParams()
  const search = Route.useSearch()
  const { data: dashboard, isLoading } = useManagedDashboard(dashboardId)
  const config = dashboard?.config

  // URL → derived state. Memoize the parser outputs so the renderer's
  // [config.id] effect does not re-run on unrelated search-param churn.
  const initialFilters = useMemo(() => parseFilterParams(search), [search])
  const lockedFilters = useMemo(() => parseLockedFilters(search), [search])
  const hideTokens = useMemo(() => parseHideTokens(search), [search])

  // Build the `filterParams` query string for the "Open in RecViz" link in
  // the EmbedTopbar. Preserve every `filter.*` key (including the reserved
  // `filter.lock`) so the recipient lands in the regular view route with
  // the exact same applied + locked state. The `hide` and `theme` params
  // are deliberately NOT forwarded — those only make sense in embed mode.
  const filterParams = useMemo(() => {
    const entries: string[] = []
    for (const [key, val] of Object.entries(search)) {
      if (key.startsWith('filter.') && typeof val === 'string') {
        entries.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(val)}`,
        )
      }
    }
    return entries.join('&')
  }, [search])

  // Apply `?theme=` via the ThemeProvider (preserved pre-existing behavior).
  const { setTheme: applyTheme } = useTheme()
  const themeParam = typeof search.theme === 'string' ? search.theme : undefined
  useEffect(() => {
    if (themeParam === 'dark' || themeParam === 'light') {
      applyTheme(themeParam)
    }
  }, [themeParam, applyTheme])

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="h-9 border-b bg-muted/30" />
        <div className="p-6 space-y-4 flex-1">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!dashboard || !config) {
    return <div className="p-6">Dashboard not found</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <EmbedTopbar
        title={dashboard.name}
        dashboardId={dashboardId}
        filterParams={filterParams}
        hideTitle={hideTokens.has('title')}
      />
      <div className="p-6 flex-1 overflow-auto space-y-6">
        <DashboardRenderer
          config={config}
          initialFilters={initialFilters}
          lockedFilters={lockedFilters}
          hideFilterBar={hideTokens.has('filter-bar')}
          hideToolbar={hideTokens.has('toolbar')}
        />
      </div>
    </div>
  )
}
