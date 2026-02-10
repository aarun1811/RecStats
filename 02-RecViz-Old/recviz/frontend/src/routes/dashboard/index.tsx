import { createFileRoute, Link } from '@tanstack/react-router'

import { useDashboards } from '@/hooks/use-dashboards'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardListPage,
})

function DashboardListPage() {
  const { data: dashboards, isLoading, error } = useDashboards()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
        <p className="text-sm text-muted-foreground">
          Select a dashboard to view reconciliation analytics.
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load dashboards: {error.message}
        </p>
      )}

      {dashboards && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <Link key={d.id} to="/dashboard/$dashboardId" params={{ dashboardId: d.id }}>
              <Card className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50">
                <CardHeader>
                  <h3 className="font-semibold">{d.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {d.description || 'No description'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {d.charts.length} chart{d.charts.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
