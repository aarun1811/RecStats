import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ViewMode = 'grid' | 'list'

interface DataSourcesToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onAddClick: () => void
}

export function DataSourcesToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onAddClick,
}: DataSourcesToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search databases..."
          className="pl-8 h-8 text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
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
      <Button size="sm" className="h-8" onClick={onAddClick}>
        <Plus className="mr-1.5 size-3.5" />
        Add Source
      </Button>
    </div>
  )
}
