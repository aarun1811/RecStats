import { useState, useMemo } from 'react'

import { Gauge, Plus, Search } from 'lucide-react'
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
import { useManagedKpis } from '@/hooks/use-managed-kpis'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import type { RecvizKpi } from '@/types/managed-kpi'

interface KpiPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectKpi: (kpi: RecvizKpi) => void
}

export function KpiPickerDialog({
  open,
  onOpenChange,
  onSelectKpi,
}: KpiPickerDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data: kpis, isLoading: kpisLoading } = useManagedKpis()
  const { data: datasets } = useManagedDatasets()

  const datasetNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (datasets) {
      for (const ds of datasets) {
        map.set(ds.id, ds.name)
      }
    }
    return map
  }, [datasets])

  const filtered = useMemo(() => {
    if (!kpis) return []
    if (!search.trim()) return kpis
    const q = search.toLowerCase()
    return kpis.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.description.toLowerCase().includes(q)
    )
  }, [kpis, search])

  function handleAdd() {
    const kpi = filtered.find((k) => k.id === selectedId)
    if (kpi) {
      onSelectKpi(kpi)
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
          <DialogTitle>Add KPI</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search KPIs..."
            className="h-9 pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="max-h-[60vh] mt-4">
          {kpisLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No KPIs found
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((kpi, i) => (
                <motion.div
                  key={kpi.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className={cn(
                    'border rounded-lg p-3 cursor-pointer hover:border-primary/30 hover:bg-accent/50 transition-colors',
                    selectedId === kpi.id && 'border-primary bg-primary/5'
                  )}
                  onClick={() => setSelectedId(kpi.id)}
                >
                  <div className="flex items-center gap-2">
                    <Gauge className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">
                      {kpi.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {datasetNameMap.get(kpi.datasetId) ?? 'Unknown dataset'}
                  </p>
                  <Badge variant="secondary" className="mt-1.5 text-xs">
                    {kpi.aggregation}
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
          onClick={() => navigate({ to: '/kpis/new' })}
        >
          <Plus className="mr-1.5 size-4" />
          Create New KPI
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
