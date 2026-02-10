import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFilterStore } from '@/stores/filter-store'

export function CrossFilterIndicator() {
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const removeCrossFilter = useFilterStore((s) => s.removeCrossFilter)
  const clearCrossFilters = useFilterStore((s) => s.clearCrossFilters)

  const entries = Object.entries(crossFilters)
  const hasFilters = entries.length > 0

  return (
    <AnimatePresence>
      {hasFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/50 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Filtered by:
            </span>
            {entries.map(([chartId, filter]) => (
              <Badge
                key={chartId}
                variant="outline"
                className="gap-1 text-xs"
              >
                {filter.field} ={' '}
                {Array.isArray(filter.value)
                  ? filter.value.join(', ')
                  : String(filter.value)}
                <button
                  type="button"
                  onClick={() => removeCrossFilter(chartId)}
                  className="ml-0.5 rounded-full hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={clearCrossFilters}
            >
              Clear all
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
