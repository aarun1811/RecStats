import { useState } from 'react'
import type { GridApi, Column } from 'ag-grid-community'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, Search, Columns3, ALargeSmall } from 'lucide-react'

type Density = 'comfortable' | 'normal' | 'compact'
const DENSITY_HEIGHT: Record<Density, number> = {
  comfortable: 48,
  normal: 40,
  compact: 32,
}

interface GridToolbarProps {
  gridApi: GridApi | null
  totalRows: number
  displayedRows: number
  quickFilter: string
  onQuickFilterChange: (value: string) => void
}

export function GridToolbar({
  gridApi,
  totalRows,
  displayedRows,
  quickFilter,
  onQuickFilterChange,
}: GridToolbarProps) {
  const [density, setDensity] = useState<Density>('normal')

  const handleExportCsv = () => {
    gridApi?.exportDataAsCsv({ fileName: 'breaks-export.csv' })
  }

  const handleDensity = (d: Density) => {
    setDensity(d)
    gridApi?.resetRowHeights()
    gridApi?.forEachNode((node: { setRowHeight: (h: number) => void }) => {
      node.setRowHeight(DENSITY_HEIGHT[d])
    })
    gridApi?.onRowHeightChanged()
  }

  const handleToggleColumn = (colId: string, visible: boolean) => {
    gridApi?.setColumnsVisible([colId], visible)
  }

  const allColumns: Column[] = gridApi?.getColumns() ?? []

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Quick filter..."
          value={quickFilter}
          onChange={(e) => onQuickFilterChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {displayedRows.toLocaleString()} of {totalRows.toLocaleString()} rows
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns3 className="mr-2 size-4" />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          {allColumns.map((col: Column) => {
            const colDef = col.getColDef()
            return (
              <DropdownMenuCheckboxItem
                key={col.getColId()}
                checked={col.isVisible()}
                onCheckedChange={(checked: boolean) =>
                  handleToggleColumn(col.getColId(), checked)
                }
              >
                {(colDef.headerName ?? col.getColId())}
              </DropdownMenuCheckboxItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ALargeSmall className="mr-2 size-4" />
            Density
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(['comfortable', 'normal', 'compact'] as Density[]).map((d) => (
            <DropdownMenuCheckboxItem
              key={d}
              checked={density === d}
              onCheckedChange={() => handleDensity(d)}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="sm" onClick={handleExportCsv}>
        <Download className="mr-2 size-4" />
        CSV
      </Button>
    </div>
  )
}
