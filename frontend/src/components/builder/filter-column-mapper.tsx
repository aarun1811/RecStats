import { AlertTriangle, Check } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export interface ChartColumnMapping {
  chartItemId: string
  chartTitle: string
  datasetId: string
  matchedColumn: string | null
  availableColumns: string[]
}

interface FilterColumnMapperProps {
  filterColumnName: string
  chartMappings: ChartColumnMapping[]
  onMappingChange: (chartItemId: string, mappedColumn: string | null) => void
}

export function FilterColumnMapper({
  filterColumnName,
  chartMappings,
  onMappingChange,
}: FilterColumnMapperProps) {
  if (chartMappings.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      <Label className="text-xs font-medium uppercase text-muted-foreground">
        Column Mapping Per Chart
      </Label>
      <p className="text-xs text-muted-foreground">
        Charts with a column named &ldquo;{filterColumnName}&rdquo; are
        auto-mapped. Override for charts with different column names.
      </p>
      {chartMappings.map((mapping) => (
        <div
          key={mapping.chartItemId}
          className="flex items-center justify-between gap-2 rounded border px-2 py-1.5"
        >
          <div className="flex min-w-0 items-center gap-2">
            {mapping.matchedColumn ? (
              <Check className="size-3 shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangle className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span className="truncate text-xs">{mapping.chartTitle}</span>
          </div>
          <Select
            value={mapping.matchedColumn ?? '__none__'}
            onValueChange={(v) =>
              onMappingChange(
                mapping.chartItemId,
                v === '__none__' ? null : v,
              )
            }
          >
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="No match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Exclude</SelectItem>
              {mapping.availableColumns.map((col) => (
                <SelectItem key={col} value={col}>
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
