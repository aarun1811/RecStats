import { useEffect } from 'react'

import { createFileRoute } from '@tanstack/react-router'

import { BuilderPage } from '@/components/builder/builder-page'
import { useBuilderStore } from '@/stores/builder-store'

export const Route = createFileRoute('/_app/dashboards/new')({
  component: NewDashboardPage,
})

function NewDashboardPage() {
  const initNew = useBuilderStore((s) => s.initNew)

  useEffect(() => {
    initNew()
  }, [initNew])

  return <BuilderPage mode="create" />
}

export default NewDashboardPage
