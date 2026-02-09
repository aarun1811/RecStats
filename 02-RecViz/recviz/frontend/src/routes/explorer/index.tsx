import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/explorer/')({
  component: ExplorerPage,
})

function ExplorerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Data Explorer</h1>
      <p className="text-muted-foreground">
        SQL editor and schema browser will be rendered here by Agent 06.
      </p>
    </div>
  )
}
