import { useState, useMemo } from 'react'

import { Plus, Search } from 'lucide-react'
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
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { useManagedCharts } from '@/hooks/use-managed-charts'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import type { RecvizChart } from '@/types/managed-chart'

interface ChartPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectChart: (chart: RecvizChart) => void
}

export function ChartPickerDialog({
  open,
  onOpenChange,
  onSelectChart,
}: ChartPickerDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data: charts, isLoading: chartsLoading } = useManagedCharts()
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
    if (!charts) return []
    if (!search.trim()) return charts
    const q = search.toLowerCase()
    return charts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    )
  }, [charts, search])

  function handleAdd() {
    const chart = filtered.find((c) => c.id === selectedId)
    if (chart) {
      onSelectChart(chart)
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
          <DialogTitle>Add Chart</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search charts..."
            className="h-9 pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="max-h-[60vh] mt-4">
          {chartsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No charts found
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((chart) => (
                <div
                  key={chart.id}
                  className={cn(
                    'border rounded-lg p-3 cursor-pointer hover:border-primary/30 hover:bg-accent/50 transition-colors',
                    selectedId === chart.id && 'border-primary bg-primary/5'
                  )}
                  onClick={() => setSelectedId(chart.id)}
                >
                  <div className="flex items-center gap-2">
                    <ChartTypeIcon
                      chartType={chart.chartType}
                      className="size-4"
                    />
                    <span className="text-sm font-medium truncate">
                      {chart.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {datasetNameMap.get(chart.datasetId) ?? 'Unknown dataset'}
                  </p>
                  <Badge variant="secondary" className="mt-1.5 text-xs">
                    {CHART_DISPLAY_NAMES[chart.chartType] ?? chart.chartType}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          onClick={() => navigate({ to: '/charts/new' })}
        >
          <Plus className="mr-1.5 size-4" />
          Create New Chart
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
