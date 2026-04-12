import { ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import {
  CHART_TYPE_BORDER_COLORS,
  CHART_TYPE_PILL_BG,
  CHART_TYPE_PILL_TEXT,
} from '@/lib/style-constants'
import type { RecvizChart } from '@/types/managed-chart'

interface ChartLibraryRowProps {
  chart: RecvizChart
  datasetName: string
  onClick: () => void
  index: number
}

export function ChartLibraryRow({ chart, datasetName, onClick, index }: ChartLibraryRowProps) {
  const displayType = CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType
  const timeAgo = formatDistanceToNow(new Date(chart.updatedAt), { addSuffix: true })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2, ease: 'easeOut' }}
      whileHover={{ y: -1 }}
      className={cn(
        'group flex items-center gap-4 rounded-lg border border-l-2 px-4 py-3',
        'cursor-pointer transition-shadow duration-150',
        'hover:border-primary/20 hover:bg-muted/30',
        CHART_TYPE_BORDER_COLORS[chart.chartType],
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
      {/* Icon + chart type — compact badge-like container */}
      <div className={cn('flex items-center justify-center size-9 rounded-md shrink-0', CHART_TYPE_PILL_BG[chart.chartType])}>
        <ChartTypeIcon chartType={chart.chartType} size={18} className={CHART_TYPE_PILL_TEXT[chart.chartType]} />
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate leading-snug">{chart.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {displayType}
          {chart.description && (
            <>
              <span className="mx-1.5 opacity-40">&middot;</span>
              {chart.description}
            </>
          )}
        </p>
      </div>

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
