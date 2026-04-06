import { useEffect } from 'react'

import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { BuilderCanvas } from '@/components/builder/builder-canvas'
import { Input } from '@/components/ui/input'
import { useManagedDashboard } from '@/hooks/use-managed-dashboards'
import { useBuilderStore } from '@/stores/builder-store'

export const Route = createFileRoute('/_app/dashboards/$dashboardId/edit')({
  component: EditDashboardPage,
})

function EditDashboardPage() {
  const { dashboardId } = Route.useParams()
  const { data: dashboard, isLoading, isError } = useManagedDashboard(dashboardId)

  const initFromConfig = useBuilderStore((s) => s.initFromConfig)
  const name = useBuilderStore((s) => s.name)
  const updateName = useBuilderStore((s) => s.updateName)
  const storeId = useBuilderStore((s) => s.dashboardId)

  useEffect(() => {
    if (dashboard && storeId !== dashboardId) {
      initFromConfig(dashboardId, dashboard.config)
    }
  }, [dashboard, dashboardId, storeId, initFromConfig])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-var(--header-height,56px))]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !dashboard) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-var(--header-height,56px))]">
        <div className="text-center">
          <h2 className="text-lg font-medium">Dashboard not found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The dashboard you are looking for does not exist or has been deleted.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,56px))]">
      <div className="shrink-0 px-6 py-4">
        <Input
          value={name}
          onChange={(e) => updateName(e.target.value)}
          placeholder="Untitled Dashboard"
          className="text-2xl font-semibold tracking-tight border-transparent hover:border-input focus:border-input bg-transparent h-auto py-1 px-2 max-w-md"
        />
        <p className="text-xs text-muted-foreground mt-1 px-2">
          Drag and drop panels to build your dashboard
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <BuilderCanvas />
      </div>
    </div>
  )
}

export default EditDashboardPage
