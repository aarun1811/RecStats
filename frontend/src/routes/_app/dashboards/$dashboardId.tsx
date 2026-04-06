import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'

import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagedDashboard } from '@/hooks/use-managed-dashboards'

export const Route = createFileRoute('/_app/dashboards/$dashboardId')({
  component: DashboardPage,
})

function DashboardPage() {
  const { dashboardId } = Route.useParams()
  const navigate = useNavigate()
  const { data: dashboard, isLoading } = useManagedDashboard(dashboardId)

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

  if (!dashboard) {
    return <div className="p-6 text-muted-foreground">Dashboard not found</div>
  }

  const config = dashboard.config

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {config.name}
          </h1>
          {config.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          )}
        </div>
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
      <DashboardRenderer config={config} />
    </div>
  )
}
