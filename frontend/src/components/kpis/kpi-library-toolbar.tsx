import { Gauge, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RecvizDataset } from '@/types/managed-dataset'

type ViewMode = 'grid' | 'list'

interface KpiLibraryToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  datasetFilter: string
  onDatasetFilterChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  datasets: RecvizDataset[]
}

export function KpiLibraryToolbar({
  searchQuery,
  onSearchChange,
  datasetFilter,
  onDatasetFilterChange,
  viewMode,
  onViewModeChange,
  datasets,
}: KpiLibraryToolbarProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search KPIs..."
          className="pl-8 h-8 text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={datasetFilter} onValueChange={onDatasetFilterChange}>
        <SelectTrigger className="h-8 w-[180px] text-sm">
          <SelectValue placeholder="All datasets" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All datasets</SelectItem>
          {datasets.map((ds) => (
            <SelectItem key={ds.id} value={ds.id}>
              {ds.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={viewMode}
        onValueChange={(v) => {
          if (v) onViewModeChange(v as ViewMode)
        }}
      >
        <ToggleGroupItem value="list" aria-label="List view">
          <List className="size-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid className="size-3.5" />
        </ToggleGroupItem>
      </ToggleGroup>
      <Button size="sm" className="h-8" asChild>
        <Link to="/kpis/new">
          <Plus className="mr-1.5 size-3.5" />
          New KPI
        </Link>
      </Button>
    </div>
  )
}
