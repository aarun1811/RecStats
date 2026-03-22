import { createFileRoute } from '@tanstack/react-router'

import DashboardPage from '@/pages/dashboard'
import { useDashboard } from '@/hooks/use-dashboards'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/dashboard/$dashboardId')({
  component: DashboardDetailRoute,
})

function DashboardDetailRoute() {
  const { dashboardId } = Route.useParams()
  const { data: config, isLoading, error } = useDashboard(dashboardId)

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          {error ? `Failed to load dashboard: ${error.message}` : 'Dashboard not found'}
        </p>
      </div>
    )
  }

  return <DashboardPage config={config} />
}
