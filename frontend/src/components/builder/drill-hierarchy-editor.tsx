import { useCallback, useState } from 'react'

import { GripVertical, X } from 'lucide-react'

import { Label } from '@/components/ui/label'
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

  // Filter to dimension columns only -- measures don't make sense as drill levels
  const dimensionColumns = (dataset?.columns ?? []).filter(
    (col) => col.role === 'dimension',
  )

  // Columns not already in the hierarchy (available for adding)
  const selectedSet = new Set(hierarchy)
  const availableColumns = dimensionColumns.filter(
    (col) => !selectedSet.has(col.name),
  )

  // Get display name for a column name
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
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase text-muted-foreground">
        Drill Hierarchy
      </Label>

      {/* Ordered list of selected drill levels */}
      {hierarchy.length > 0 && (
        <div className="space-y-1">
          {hierarchy.map((colName, index) => (
            <div
              key={colName}
              className="flex items-center gap-2 rounded border px-2 py-1.5"
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <GripVertical className="size-3 cursor-grab text-muted-foreground" />
              <span className="flex-1 text-xs">{getDisplayName(colName)}</span>
              <button
                type="button"
                onClick={() => removeLevel(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Level select */}
      {availableColumns.length > 0 && (
        <Select
          onValueChange={(colName) =>
            onHierarchyChange([...hierarchy, colName])
          }
          value=""
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="+ Add Level" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                {col.displayName || col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Detail Data Source */}
      <Label className="mt-3 text-xs font-medium uppercase text-muted-foreground">
        Detail Data Source
      </Label>
      <Select
        value={drillDetailDataSourceId ?? 'none'}
        onValueChange={(v) =>
          onDetailDataSourceChange(v === 'none' ? null : v)
        }
      >
        <SelectTrigger className="h-7 text-xs">
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
  )
}
