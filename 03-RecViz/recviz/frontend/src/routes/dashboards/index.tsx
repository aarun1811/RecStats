import { createFileRoute, Link } from '@tanstack/react-router'
import { useDashboards } from '@/hooks/use-dashboards'

export const Route = createFileRoute('/dashboards/')({
  component: DashboardList,
})

function DashboardList() {
  const { data: dashboards, isLoading } = useDashboards()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Dashboards</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4">
          {dashboards?.map((d) => (
            <Link
              key={d.id}
              to="/dashboards/$dashboardId"
              params={{ dashboardId: d.id }}
              className="block rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <h2 className="font-medium">{d.title}</h2>
              {d.description && (
                <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
