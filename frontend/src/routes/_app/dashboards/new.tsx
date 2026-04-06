import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/dashboards/new')({
  component: NewDashboardPage,
})

function NewDashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Dashboard</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Builder canvas will be added in Plan 03.
      </p>
    </div>
  )
}

export default NewDashboardPage
