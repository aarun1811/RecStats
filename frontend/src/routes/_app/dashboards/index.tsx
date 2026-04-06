import { createFileRoute } from '@tanstack/react-router'

import { DashboardList } from '@/components/dashboard/dashboard-list'

export const Route = createFileRoute('/_app/dashboards/')({
  component: DashboardListPage,
})

function DashboardListPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        Dashboards
      </h1>
      <DashboardList />
    </div>
  )
}
