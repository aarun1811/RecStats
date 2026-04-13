import { useCallback, useState } from 'react'

import { ArrowDown, ChevronDown, GripVertical, Table2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useManagedDataset } from '@/hooks/use-managed-datasets'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'

interface DrillHierarchyEditorProps {
  datasetId: string
  hierarchy: string[]
  drillDetailDataSourceId: string | null
  onHierarchyChange: (hierarchy: string[]) => void
  onDetailDataSourceChange: (id: string | null) => void
}

export function DrillHierarchyEditor({
  datasetId,
  hierarchy,
  drillDetailDataSourceId,
  onHierarchyChange,
  onDetailDataSourceChange,
}: DrillHierarchyEditorProps) {
  const { data: dataset } = useManagedDataset(datasetId)
  const { data: allDatasets } = useManagedDatasets()

  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const dimensionColumns = (dataset?.columns ?? []).filter(
    (col) => col.role === 'dimension',
  )

  const selectedSet = new Set(hierarchy)
  const availableColumns = dimensionColumns.filter(
    (col) => !selectedSet.has(col.name),
  )

  const getDisplayName = useCallback(
    (colName: string) => {
      const col = dataset?.columns.find((c) => c.name === colName)
      return col?.displayName || colName
    },
    [dataset],
  )

  const removeLevel = useCallback(
    (index: number) => {
      const next = hierarchy.filter((_, i) => i !== index)
      onHierarchyChange(next)
    },
    [hierarchy, onHierarchyChange],
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index)
      e.dataTransfer.effectAllowed = 'move'
    },
    [],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()
      if (dragIndex === null || dragIndex === dropIndex) return
      const next = [...hierarchy]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(dropIndex, 0, moved)
      onHierarchyChange(next)
      setDragIndex(null)
    },
    [dragIndex, hierarchy, onHierarchyChange],
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
  }, [])

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      {/* ── Drill path: levels ── */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-2">
          Drill Path
        </p>

        {hierarchy.length > 0 ? (
          <div className="space-y-0">
            {hierarchy.map((colName, index) => (
              <div key={colName}>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-border/40 bg-background px-2.5 py-1.5',
                    'transition-colors hover:border-primary/30',
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <GripVertical className="size-3 cursor-grab text-muted-foreground/40" />
                  <span className="flex items-center justify-center size-5 rounded bg-primary/10 text-[10px] font-bold text-primary tabular-nums shrink-0">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-xs font-medium text-foreground">
                    {getDisplayName(colName)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLevel(index)}
                    className="text-muted-foreground/30 hover:text-destructive transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                {/* Arrow connector between levels */}
                {index < hierarchy.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ChevronDown className="size-3 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/40 bg-background/50 px-3 py-2.5 text-center">
            <p className="text-[11px] text-muted-foreground/50">
              No drill levels — add columns below
            </p>
          </div>
        )}

        {/* Add Level */}
        {availableColumns.length > 0 && (
          <div className="mt-2">
            <Select
              onValueChange={(colName) =>
                onHierarchyChange([...hierarchy, colName])
              }
              value=""
            >
              <SelectTrigger className="h-7 text-xs bg-background border-dashed border-border/40 text-muted-foreground">
                <SelectValue placeholder="+ Add drill level" />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.displayName || col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Arrow connector to detail source ── */}
      {hierarchy.length > 0 && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5 py-1">
            <ArrowDown className="size-3 text-primary/40" />
            <span className="text-[9px] font-medium tracking-wider uppercase text-primary/40">
              deepest level
            </span>
          </div>
        </div>
      )}

      {/* ── Detail data source ── */}
      <div className={cn(
        'px-3 pb-3',
        hierarchy.length > 0 ? 'pt-1' : 'pt-0',
      )}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Table2 className="size-3 text-muted-foreground/50" />
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            Detail Grid Source
          </p>
        </div>
        <Select
          value={drillDetailDataSourceId ?? 'none'}
          onValueChange={(v) =>
            onDetailDataSourceChange(v === 'none' ? null : v)
          }
        >
          <SelectTrigger className="h-8 text-xs bg-background border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {(allDatasets ?? []).map((ds) => (
              <SelectItem key={ds.id} value={ds.id}>
                {ds.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
