import { AnimatePresence, motion } from 'motion/react'

import { useFilterStore } from '@/stores/filter-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, FilterX } from 'lucide-react'

interface CrossFilterBarProps {
  columnLabels?: Record<string, string>
}

function formatColumnLabel(column: string, labels?: Record<string, string>): string {
  if (labels && labels[column]) return labels[column]
  // Fallback: capitalize first letter, replace underscores with spaces
  return column
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

export function CrossFilterBar({ columnLabels }: CrossFilterBarProps) {
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const removeCrossFilter = useFilterStore((s) => s.removeCrossFilter)
  const clearCrossFilters = useFilterStore((s) => s.clearCrossFilters)

  return (
    <AnimatePresence>
      {crossFilters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          aria-live="polite"
        >
          <div className="bg-muted/50 rounded-lg px-3 py-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Filtered by:
            </span>
            <AnimatePresence mode="popLayout">
              {crossFilters.map((filter) => {
                const label = formatColumnLabel(filter.column, columnLabels)
                return (
                  <motion.div
                    key={`${filter.sourceChartId}-${filter.column}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {label}: {String(filter.value)}
                      <button
                        onClick={() =>
                          removeCrossFilter(filter.sourceChartId, filter.column)
                        }
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                        aria-label={`Remove filter ${label}: ${filter.value}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearCrossFilters}
            >
              <FilterX className="mr-1 size-3" />
              Clear all
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
