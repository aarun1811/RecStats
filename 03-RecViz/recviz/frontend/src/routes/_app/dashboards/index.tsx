import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, Plus } from 'lucide-react'
import { useDashboards } from '@/hooks/use-dashboards'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'

export const Route = createFileRoute('/_app/dashboards/')({
  component: DashboardList,
})

function DashboardSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-full" />
            <div className="mt-3 flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </>
  )
}

function DashboardList() {
  const { data: dashboards, isLoading } = useDashboards()
  const navigate = useNavigate()

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
        <Button variant="outline" disabled>
          <Plus className="mr-2 size-4" />
          Create Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <DashboardSkeleton />
        ) : dashboards?.length ? (
          dashboards.map((d) => (
            <Card
              key={d.id}
              className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() =>
                navigate({
                  to: '/dashboards/$dashboardId',
                  params: { dashboardId: d.id },
                })
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{d.title}</CardTitle>
                  <span
                    className={`mt-0.5 size-2.5 rounded-full ${
                      d.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    title={d.status ?? 'active'}
                  />
                </div>
                <CardDescription className="line-clamp-2">
                  {d.description ?? 'No description'}
                </CardDescription>
                <div className="mt-3 flex items-center gap-2">
                  {d.chartCount != null && (
                    <Badge variant="secondary">
                      {d.chartCount} chart{d.chartCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {d.changedOn && (
                    <span className="text-xs text-muted-foreground">
                      Updated {d.changedOn}
                    </span>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LayoutDashboard />
                </EmptyMedia>
                <EmptyTitle>No dashboards configured</EmptyTitle>
                <EmptyDescription>
                  Dashboards will appear here once they are created and
                  registered with Superset.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>
    </div>
  )
}
