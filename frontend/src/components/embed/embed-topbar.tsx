import { ExternalLink } from 'lucide-react'

interface EmbedTopbarProps {
  title: string
  dashboardId: string
  filterParams: string
  /**
   * When true, omit the title `<span>` but keep the bar (height, border, bg)
   * and the "Open in RecViz" link. Driven by the `?hide=title` URL token on
   * the embed route. The topbar itself is ALWAYS rendered in Phase 9 per
   * D-06 (no fully chromeless mode).
   */
  hideTitle?: boolean
}

export function EmbedTopbar({
  title,
  dashboardId,
  filterParams,
  hideTitle,
}: EmbedTopbarProps) {
  const recvizUrl = `/dashboards/${dashboardId}${filterParams ? `?${filterParams}` : ''}`

  // When the title is hidden, flip the flex container to `justify-end` so the
  // "Open in RecViz" link stays right-aligned (per UI-SPEC: "right-aligned,
  // the only element in the bar").
  const containerClasses = `h-9 border-b flex items-center ${
    hideTitle ? 'justify-end' : 'justify-between'
  } px-4 bg-muted/30 flex-shrink-0`

  return (
    <div className={containerClasses}>
      {!hideTitle && (
        <span className="text-sm font-medium text-foreground">{title}</span>
      )}
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
