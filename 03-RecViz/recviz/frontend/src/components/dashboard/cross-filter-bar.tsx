import { useFilterStore } from '@/stores/filter-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, FilterX } from 'lucide-react'

const COLUMN_LABELS: Record<string, string> = {
  desk: 'Desk',
  category: 'Category',
  agingBucket: 'Aging',
  createdDate: 'Date',
  status: 'Status',
  region: 'Region',
  breakType: 'Type',
  lob: 'LOB',
}

export function CrossFilterBar() {
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const removeCrossFilter = useFilterStore((s) => s.removeCrossFilter)
  const clearCrossFilters = useFilterStore((s) => s.clearCrossFilters)

  if (crossFilters.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-muted-foreground">Cross-filters:</span>
      {crossFilters.map((filter) => (
        <Badge
          key={`${filter.sourceChartId}-${filter.column}`}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {COLUMN_LABELS[filter.column] ?? filter.column}: {String(filter.value)}
          <button
            onClick={() => removeCrossFilter(filter.sourceChartId)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
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
  )
}
