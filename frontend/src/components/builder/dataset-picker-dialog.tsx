import { useState, useMemo } from 'react'

import { Plus, Search, Table2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigate } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import type { RecvizDataset } from '@/types/managed-dataset'

interface DatasetPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectDataset: (dataset: RecvizDataset) => void
}

export function DatasetPickerDialog({
  open,
  onOpenChange,
  onSelectDataset,
}: DatasetPickerDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data: datasets, isLoading: datasetsLoading } = useManagedDatasets()

  const filtered = useMemo(() => {
    if (!datasets) return []
    if (!search.trim()) return datasets
    const q = search.toLowerCase()
    return datasets.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    )
  }, [datasets, search])

  function handleAdd() {
    const dataset = filtered.find((d) => d.id === selectedId)
    if (dataset) {
      onSelectDataset(dataset)
      setSearch('')
      setSelectedId(null)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSearch('')
      setSelectedId(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Data Grid</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search datasets..."
            className="h-9 pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="max-h-[60vh] mt-4">
          {datasetsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No datasets found
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((dataset, i) => (
                <motion.div
                  key={dataset.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className={cn(
                    'border rounded-lg p-3 cursor-pointer hover:border-primary/30 hover:bg-accent/50 transition-colors',
                    selectedId === dataset.id && 'border-primary bg-primary/5'
                  )}
                  onClick={() => setSelectedId(dataset.id)}
                >
                  <div className="flex items-center gap-2">
                    <Table2 className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">
                      {dataset.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {dataset.description || 'No description'}
                  </p>
                  <Badge variant="secondary" className="mt-1.5 text-xs">
                    {dataset.columns.length} column{dataset.columns.length !== 1 ? 's' : ''}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          onClick={() => navigate({ to: '/datasets/new' })}
        >
          <Plus className="mr-1.5 size-4" />
          Create New Dataset
        </Button>

        <DialogFooter>
          <Button disabled={!selectedId} onClick={handleAdd}>
            Add to Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
