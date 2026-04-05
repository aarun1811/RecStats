import { useState } from 'react'
import type { GridApi, Column } from 'ag-grid-community'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Columns3,
  ALargeSmall,
  ArrowLeftRight,
  FileDown,
  Sheet,
  Loader2,
} from 'lucide-react'
import { sanitizeFilename } from '@/lib/chart-export'

type Density = 'comfortable' | 'normal' | 'compact'

const DENSITY_HEIGHT: Record<Density, number> = {
  comfortable: 48,
  normal: 40,
  compact: 32,
}

interface GridToolbarProps {
  /** AG Grid API instance, passed directly from parent's onGridReady state (not forwardRef). */
  gridApi: GridApi | null
  gridTitle: string
  totalRows: number
  displayedRows: number
  quickFilter: string
  onQuickFilterChange: (value: string) => void
}

export function GridToolbar({
  gridApi,
  gridTitle,
  totalRows,
  displayedRows,
  quickFilter,
  onQuickFilterChange,
}: GridToolbarProps) {
  const [density, setDensity] = useState<Density>('normal')
  const [isExporting, setIsExporting] = useState(false)

  // AG Grid exports filtered/sorted view by default (WYSIWYG) -- no allColumns/allRows override needed
  const handleCsvExport = () => {
    gridApi?.exportDataAsCsv({
      fileName:
        sanitizeFilename(gridTitle) +
        '-' +
        new Date().toISOString().slice(0, 10) +
        '.csv',
    })
    toast.success('Grid exported as CSV')
  }

  const handleExcelExport = () => {
    setIsExporting(true)
    // Use requestAnimationFrame to allow UI to update before potentially blocking export
    requestAnimationFrame(() => {
      try {
        gridApi?.exportDataAsExcel({
          fileName:
            sanitizeFilename(gridTitle) +
            '-' +
            new Date().toISOString().slice(0, 10) +
            '.xlsx',
          sheetName: 'Data',
        })
        toast.success('Grid exported as Excel')
      } catch {
        toast.error('Excel export failed. Please try again.')
      } finally {
        setIsExporting(false)
      }
    })
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

  const handleAutoSize = () => {
    gridApi?.autoSizeAllColumns()
  }

  const allColumns: Column[] = gridApi?.getColumns() ?? []

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: Search + Row count */}
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
        <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
          {displayedRows.toLocaleString()} of {totalRows.toLocaleString()} rows
        </span>
      </div>

      {/* Row 2: Action buttons */}
      <div className="flex items-center gap-2">
        {/* Columns dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 className="mr-1.5 size-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
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
                  {colDef.headerName ?? col.getColId()}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Density dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ALargeSmall className="mr-1.5 size-4" />
              Density
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
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

        {/* Auto-size button */}
        <Button variant="outline" size="sm" onClick={handleAutoSize}>
          <ArrowLeftRight className="mr-1.5 size-4" />
          Auto-size
        </Button>

        {/* CSV export button */}
        <Button variant="outline" size="sm" onClick={handleCsvExport}>
          <FileDown className="mr-1.5 size-4" />
          CSV
        </Button>

        {/* Excel export button with loading state */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExcelExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Sheet className="mr-1.5 size-4" />
          )}
          Excel
        </Button>
      </div>
    </div>
  )
}
