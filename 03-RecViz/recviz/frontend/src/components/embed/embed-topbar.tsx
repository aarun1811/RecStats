import { ExternalLink } from 'lucide-react'

interface EmbedTopbarProps {
  title: string
  dashboardId: string
  filterParams: string
}

export function EmbedTopbar({ title, dashboardId, filterParams }: EmbedTopbarProps) {
  const recvizUrl = `/dashboards/${dashboardId}${filterParams ? `?${filterParams}` : ''}`

  return (
    <div className="h-9 border-b flex items-center justify-between px-4 bg-muted/30 flex-shrink-0">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <a
        href={recvizUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/30 bg-primary/10 rounded px-2.5 py-1"
      >
        <ExternalLink className="h-3 w-3" />
        Open in RecViz
      </a>
    </div>
  )
}
