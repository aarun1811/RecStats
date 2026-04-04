import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useDashboardConfig } from '@/hooks/use-dashboard-config'
import { useTheme } from '@/components/layout/theme-provider'
import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { EmbedTopbar } from '@/components/embed/embed-topbar'
import { Skeleton } from '@/components/ui/skeleton'
import type { FilterValue } from '@/types/filter'

export const Route = createFileRoute('/embed/dashboards/$dashboardId')({
  component: EmbedDashboardPage,
  validateSearch: (search: Record<string, unknown>) => search,
})

function EmbedDashboardPage() {
  const { dashboardId } = Route.useParams()
  const search = Route.useSearch()
  const { data: config, isLoading } = useDashboardConfig(dashboardId)

  // Parse filter.* params and lock param from URL
  const initialFilters: Record<string, FilterValue> = {}
  const filterParams: string[] = []
  for (const [key, val] of Object.entries(search)) {
    if (key.startsWith('filter.') && typeof val === 'string') {
      const filterId = key.replace('filter.', '')
      // Comma-separated values become arrays
      initialFilters[filterId] = val.includes(',') ? val.split(',') : val
      filterParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    }
  }

  const rawLock = search['filter.lock']
  const lockParam = typeof rawLock === 'string' ? rawLock : ''
  const lockedFilters = lockParam ? lockParam.split(',') : []
  if (lockParam) filterParams.push(`filter.lock=${lockParam}`)

  // Apply theme from URL via ThemeProvider
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

  if (!config) {
    return <div className="p-6">Dashboard not found</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <EmbedTopbar
        title={config.name}
        dashboardId={dashboardId}
        filterParams={filterParams.join('&')}
      />
      <div className="p-6 flex-1 overflow-auto space-y-6">
        <DashboardRenderer
          config={config}
          initialFilters={initialFilters}
          lockedFilters={lockedFilters}
        />
      </div>
    </div>
  )
}
