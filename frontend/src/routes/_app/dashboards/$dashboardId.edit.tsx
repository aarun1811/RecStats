import { useEffect } from 'react'

import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { BuilderPage } from '@/components/builder/builder-page'
import { useDashboardConfig } from '@/hooks/use-dashboard-config'
import { useBuilderStore } from '@/stores/builder-store'

export const Route = createFileRoute('/_app/dashboards/$dashboardId/edit')({
  component: EditDashboardPage,
})

function EditDashboardPage() {
  const { dashboardId } = Route.useParams()
  const { data: config, isLoading, isError } = useDashboardConfig(dashboardId)

  const initFromConfig = useBuilderStore((s) => s.initFromConfig)
  const storeId = useBuilderStore((s) => s.dashboardId)

  useEffect(() => {
    if (config && storeId !== dashboardId) {
      initFromConfig(dashboardId, config)
    }
  }, [config, dashboardId, storeId, initFromConfig])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height,56px))] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !config) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height,56px))] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium">Dashboard not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The dashboard you are looking for does not exist or has been deleted.
          </p>
        </div>
      </div>
    )
  }

  return <BuilderPage mode="edit" />
}

export default EditDashboardPage
