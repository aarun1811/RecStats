import { useEffect, useMemo, useRef } from 'react'

import {
  createFileRoute,
  Outlet,
  useMatchRoute,
  useNavigate,
} from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { BarChart3, Gauge, Pencil, Table2 } from 'lucide-react'

import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { ShareLinkButton } from '@/components/dashboard/share-link-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagedDashboard } from '@/hooks/use-managed-dashboards'
import {
  parseFilterParams,
  serializeFilterParams,
  stripFilterParams,
} from '@/lib/dashboard-url-state'
import { useFilterStore } from '@/stores/filter-store'

export const Route = createFileRoute('/_app/dashboards/$dashboardId')({
  // Permissive validateSearch — pass everything through; per-key parsing is
  // handled by lib/dashboard-url-state.ts. Matches the embed route convention.
  validateSearch: (search: Record<string, unknown>) => search,
  component: DashboardPage,
})

function countPanels(config: unknown): { kpis: number; charts: number; grids: number } {
  const cfg = (config ?? {}) as Record<string, unknown>
  const len = (key: string) => Array.isArray(cfg[key]) ? (cfg[key] as unknown[]).length : 0
  return { kpis: len('kpis'), charts: len('charts'), grids: len('grids') }
}

function DashboardPage() {
  const { dashboardId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const matchRoute = useMatchRoute()
  const { data: dashboard, isLoading } = useManagedDashboard(dashboardId)
  const config = dashboard?.config

  // The edit route ($dashboardId.edit.tsx) is a CHILD of this route per
  // TanStack Router's dot-notation file-based routing. When the URL is
  // /dashboards/:id/edit, this parent component still mounts and must
  // delegate rendering to the child via <Outlet />, NOT render its own
  // view UI on top of the BuilderPage.
  //
  // Rule 3 (auto-fix blocking): without this guard, navigating to /edit
  // shows the view route instead of BuilderPage. Discovered by the
  // dashboard-edit-regression e2e test created in Wave 0.
  const isEditChildActive = !!matchRoute({
    to: '/dashboards/$dashboardId/edit',
    params: { dashboardId },
  })

  // Parse URL → initial filters once on mount. The memo provides referential
  // stability so DashboardRenderer's [config.id] effect does not re-run on
  // every search change. Re-hydration is the renderer's responsibility,
  // keyed on config.id.
  const initialFilters = useMemo(() => parseFilterParams(search), [search])

  // Bidirectional URL writer: store → URL on `applied` change.
  // Disabled when the edit child route is active so the builder is not
  // polluted with filter params from a previous view-route session.
  const applied = useFilterStore((s) => s.applied)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (isEditChildActive) return
    // Skip the first run — the URL just hydrated the store, no need to write
    // it back (would be a no-op but the function-form spread can churn).
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      return
    }
    const handle = setTimeout(() => {
      navigate({
        // Function form is mandatory — passing a plain object would replace
        // ALL search params, wiping out e.g. ?theme=dark.
        search: (prev) => ({
          ...stripFilterParams(prev),
          ...serializeFilterParams(applied),
        }),
        // history.replaceState — does NOT push a new history entry, so the
        // back button is not polluted with intermediate filter states (D-03).
        replace: true,
      })
    }, 300)
    return () => clearTimeout(handle)
  }, [applied, navigate, isEditChildActive])

  // When the edit child route is matched, render ONLY the Outlet — let the
  // BuilderPage own the screen. Skip the view-mode skeleton, header, and
  // DashboardRenderer entirely.
  if (isEditChildActive) {
    return <Outlet />
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  const counts = useMemo(() => countPanels(config), [config])
  const totalPanels = counts.kpis + counts.charts + counts.grids
  const timeAgo = dashboard?.updatedAt
    ? formatDistanceToNow(new Date(dashboard.updatedAt), { addSuffix: true })
    : undefined

  if (!dashboard || !config) {
    return <div className="p-6 text-muted-foreground">Dashboard not found</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dashboard.name}
          </h1>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {dashboard.description}
            </p>
          )}
          {(totalPanels > 0 || timeAgo) && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              {counts.kpis > 0 && (
                <span className="flex items-center gap-1">
                  <Gauge size={14} /> {counts.kpis} KPIs
                </span>
              )}
              {counts.charts > 0 && (
                <span className="flex items-center gap-1">
                  <BarChart3 size={14} /> {counts.charts} Charts
                </span>
              )}
              {counts.grids > 0 && (
                <span className="flex items-center gap-1">
                  <Table2 size={14} /> {counts.grids} Grids
                </span>
              )}
              {totalPanels > 0 && timeAgo && <span>&middot;</span>}
              {timeAgo && <span>Updated {timeAgo}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ShareLinkButton />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                to: '/dashboards/$dashboardId/edit',
                params: { dashboardId },
              })
            }
          >
            <Pencil className="mr-1.5 size-4" />
            Edit
          </Button>
        </div>
      </div>
      <DashboardRenderer config={config} initialFilters={initialFilters} />
    </div>
  )
}
