import { ChevronRight, Gauge } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'
import {
  KPI_AGG_BORDER_COLORS,
  KPI_AGG_PILL_BG,
  KPI_AGG_PILL_TEXT,
} from '@/lib/style-constants'
import type { RecvizKpi } from '@/types/managed-kpi'

interface KpiLibraryRowProps {
  kpi: RecvizKpi
  datasetName: string
  onClick: () => void
  index: number
}

export function KpiLibraryRow({ kpi, datasetName, onClick, index }: KpiLibraryRowProps) {
  const timeAgo = formatDistanceToNow(new Date(kpi.updatedAt), { addSuffix: true })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
      className={cn(
        'group flex items-center gap-4 rounded-md border border-l-2 px-4 py-3',
        'cursor-pointer transition-all duration-150',
        'hover:border-primary/20 hover:bg-muted/50',
        KPI_AGG_BORDER_COLORS[kpi.aggregation],
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
      <div className="flex items-center justify-center size-9 rounded-md bg-primary/5 border border-primary/10 shrink-0">
        <Gauge size={18} className="text-muted-foreground" />
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-snug">{kpi.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {kpi.description || 'No description'}
        </p>
      </div>

      {/* Aggregation pill */}
      <span className={cn(
        'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        KPI_AGG_PILL_BG[kpi.aggregation],
        KPI_AGG_PILL_TEXT[kpi.aggregation],
      )}>
        {kpi.aggregation}
      </span>

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
    </motion.div>
  )
}
