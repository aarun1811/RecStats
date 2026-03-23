import { createFileRoute } from '@tanstack/react-router'

import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { useDashboardConfig } from '@/hooks/use-dashboard-config'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_app/dashboards/$dashboardId')({
  component: DashboardPage,
})

function DashboardPage() {
  const { dashboardId } = Route.useParams()
  const { data: config, isLoading } = useDashboardConfig(dashboardId)

  if (isLoading || !config) {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{config.name}</h1>
        {config.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {config.description}
          </p>
        )}
      </div>
      <DashboardRenderer config={config} />
    </div>
  )
}
