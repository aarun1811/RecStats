import { useEffect } from 'react'

import { createFileRoute } from '@tanstack/react-router'

import { BuilderCanvas } from '@/components/builder/builder-canvas'
import { Input } from '@/components/ui/input'
import { useBuilderStore } from '@/stores/builder-store'

export const Route = createFileRoute('/_app/dashboards/new')({
  component: NewDashboardPage,
})

function NewDashboardPage() {
  const initNew = useBuilderStore((s) => s.initNew)
  const name = useBuilderStore((s) => s.name)
  const updateName = useBuilderStore((s) => s.updateName)

  useEffect(() => {
    initNew()
  }, [initNew])

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

export default NewDashboardPage
