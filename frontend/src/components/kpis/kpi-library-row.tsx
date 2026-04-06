import { ChevronRight, Gauge } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { RecvizKpi } from '@/types/managed-kpi'

interface KpiLibraryRowProps {
  kpi: RecvizKpi
  datasetName: string
  onClick: () => void
}

export function KpiLibraryRow({ kpi, datasetName, onClick }: KpiLibraryRowProps) {
  const timeAgo = formatDistanceToNow(new Date(kpi.updatedAt), { addSuffix: true })

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-md border px-4 py-3',
        'cursor-pointer transition-all duration-150',
        'hover:border-primary/20 hover:bg-muted/50',
      )}
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Icon */}
      <div className="flex items-center justify-center size-9 rounded-md bg-muted/50 shrink-0">
        <Gauge size={18} className="text-muted-foreground" />
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-snug">{kpi.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {kpi.description || 'No description'}
        </p>
      </div>

      {/* Aggregation badge */}
      <Badge variant="outline" className="shrink-0 text-xs">
        {kpi.aggregation}
      </Badge>

      {/* Dataset */}
      <div className="hidden lg:block shrink-0 text-right">
        <p className="text-xs text-muted-foreground">{datasetName}</p>
      </div>

      {/* Time */}
      <div className="shrink-0 w-28 text-right">
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>

      {/* Arrow */}
      <ChevronRight
        size={14}
        className="shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </div>
  )
}
