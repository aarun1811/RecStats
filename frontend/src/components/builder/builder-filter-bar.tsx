import { useCallback, useRef, useState } from 'react'

import { GripVertical, Plus, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import type { FilterConfig } from '@/types/dashboard-config'

interface BuilderFilterBarProps {
  filters: FilterConfig[]
  onRemove: (filterId: string) => void
  onReorder: (orderedIds: string[]) => void
  onAddFilter: () => void
}

export function BuilderFilterBar({
  filters,
  onRemove,
  onReorder,
  onAddFilter,
}: BuilderFilterBarProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const dragOverId = useRef<string | null>(null)

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, filterId: string) => {
      setDraggedId(filterId)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', filterId)
    },
    [],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, filterId: string) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      dragOverId.current = filterId
    },
    [],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const fromId = draggedId
      const toId = dragOverId.current

      if (!fromId || !toId || fromId === toId) {
        setDraggedId(null)
        dragOverId.current = null
        return
      }

      const ids = filters.map((f) => f.id)
      const fromIdx = ids.indexOf(fromId)
      const toIdx = ids.indexOf(toId)

      if (fromIdx === -1 || toIdx === -1) {
        setDraggedId(null)
        dragOverId.current = null
        return
      }

      const reordered = [...ids]
      reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, fromId)

      onReorder(reordered)
      setDraggedId(null)
      dragOverId.current = null
    },
    [filters, draggedId, onReorder],
  )

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    dragOverId.current = null
  }, [])

  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-6 py-2">
      <AnimatePresence mode="popLayout">
        {filters.map((filter) => (
          <motion.div
            key={filter.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            draggable
            onDragStart={(e) => handleDragStart(e, filter.id)}
            onDragOver={(e) => handleDragOver(e, filter.id)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-sm ${
              draggedId === filter.id ? 'opacity-50' : ''
            }`}
          >
            <GripVertical className="size-3 cursor-grab text-muted-foreground" />
            <span className="text-sm">{filter.label}</span>
            <button
              type="button"
              onClick={() => onRemove(filter.id)}
              className="ml-1 rounded-sm p-0.5 hover:bg-muted"
            >
              <X className="size-3 text-muted-foreground hover:text-destructive" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button variant="ghost" size="sm" className="text-xs" onClick={onAddFilter}>
        <Plus className="mr-1 size-3" />
        Add Filter
      </Button>
    </div>
  )
}
