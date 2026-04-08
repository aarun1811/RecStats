import { useMemo } from 'react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RecvizDataset } from '@/types/managed-dataset'
import type { AggregationType } from '@/types/managed-kpi'

const AGGREGATION_OPTIONS: { value: AggregationType; label: string }[] = [
  { value: 'SUM', label: 'SUM' },
  { value: 'AVG', label: 'AVG' },
  { value: 'COUNT', label: 'COUNT' },
  { value: 'MIN', label: 'MIN' },
  { value: 'MAX', label: 'MAX' },
  { value: 'COUNT_DISTINCT', label: 'COUNT_DISTINCT' },
]

interface StepColumnProps {
  dataset: RecvizDataset | null
  metricColumn: string | null
  aggregation: AggregationType
  onColumnChange: (col: string) => void
  onAggregationChange: (agg: AggregationType) => void
}

export function StepColumn({
  dataset,
  metricColumn,
  aggregation,
  onColumnChange,
  onAggregationChange,
}: StepColumnProps) {
  const numericColumns = useMemo(() => {
    if (!dataset) return []
    return dataset.columns
      .filter((c) => c.dataType === 'number' || c.dataType === 'currency')
      .sort((a, b) => {
        // Measures first, then dimensions
        if (a.role === 'measure' && b.role !== 'measure') return -1
        if (a.role !== 'measure' && b.role === 'measure') return 1
        return a.displayName.localeCompare(b.displayName)
      })
  }, [dataset])

  const disabled = !dataset

  return (
    <div>
      {disabled ? (
        <p className="text-sm text-muted-foreground">
          Select a dataset first
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Column</Label>
            <Select
              value={metricColumn ?? ''}
              onValueChange={onColumnChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a column..." />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    <span>{col.displayName}</span>
                    {col.displayName !== col.name && (
                      <span className="ml-2 text-muted-foreground">
                        {col.name}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Aggregation</Label>
            <Select
              value={aggregation}
              onValueChange={(v) => onAggregationChange(v as AggregationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGGREGATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
