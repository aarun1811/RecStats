import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/explorer/')({
  component: Explorer,
})

function Explorer() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Data Explorer</h1>
      <p className="text-muted-foreground mt-2">SQL editor + schema browser — coming in Phase 15.</p>
    </div>
  )
}
