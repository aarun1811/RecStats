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
import { parseHideOpenInLinkFlag } from '@/lib/embed-config'

// Build-time flag (baked at build): when `VITE_EMBED_HIDE_OPEN_IN_LINK=true`,
// the embed topbar omits the "Open in RecViz" link so embedded users can't
// navigate out to the standalone app. Default shows it. See lib/embed-config.ts.
const HIDE_OPEN_IN_LINK = parseHideOpenInLinkFlag(
  import.meta.env.VITE_EMBED_HIDE_OPEN_IN_LINK,
)

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

  // Embed-only: pin <html> overflow:hidden so AG-Grid's measurement utilities
  // (ag-measurement-container, ag-aria-description-container) absolutely
  // positioned at y > viewport don't push html.scrollHeight past the viewport
  // and spawn a second scrollbar. Restore on unmount so the standalone app
  // isn't affected.
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => { html.style.overflow = prev }
  }, [])

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
    // overflow-hidden on the outer flex column + min-h-0 on the scrolling child
    // keeps <html> from also overflowing — otherwise we get TWO scrollbars
    // (the legitimate inner one + a stray viewport-level one).
    <div className="h-screen flex flex-col overflow-hidden">
      <EmbedTopbar
        title={dashboard.name}
        dashboardId={dashboardId}
        filterParams={filterParams}
        hideTitle={hideTokens.has('title')}
        hideOpenInLink={HIDE_OPEN_IN_LINK}
      />
      <div className="p-6 flex-1 min-h-0 overflow-auto space-y-6">
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
