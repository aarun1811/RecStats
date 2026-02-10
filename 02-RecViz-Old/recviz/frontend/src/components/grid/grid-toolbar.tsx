import { useCallback } from 'react'

import {
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
  Clipboard,
  Search,
} from 'lucide-react'
import type { GridApi } from 'ag-grid-community'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { Badge } from '@/components/ui/badge'

interface GridToolbarProps {
  title?: string
  rowCount: number
  gridApi: GridApi | null
  pivotMode: boolean
  onPivotModeChange: (enabled: boolean) => void
  quickFilterText: string
  onQuickFilterChange: (text: string) => void
}

export function GridToolbar({
  title,
  rowCount,
  gridApi,
  pivotMode,
  onPivotModeChange,
  quickFilterText,
  onQuickFilterChange,
}: GridToolbarProps) {
  const handleExportExcel = useCallback(() => {
    gridApi?.exportDataAsExcel()
  }, [gridApi])

  const handleExportCsv = useCallback(() => {
    gridApi?.exportDataAsCsv()
  }, [gridApi])

  const handleCopyToClipboard = useCallback(() => {
    gridApi?.copySelectedRangeToClipboard()
  }, [gridApi])

  const handleOpenColumnChooser = useCallback(() => {
    gridApi?.openToolPanel('columns')
  }, [gridApi])

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US').format(n)

  return (
    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        {title && (
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        )}
        <Badge variant="secondary" className="text-xs font-normal">
          {fmt(rowCount)} rows
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Quick filter..."
            value={quickFilterText}
            onChange={(e) => onQuickFilterChange(e.target.value)}
            className="h-8 w-48 pl-8 text-xs"
          />
        </div>

        <Toggle
          variant="outline"
          size="sm"
          pressed={pivotMode}
          onPressedChange={onPivotModeChange}
          aria-label="Toggle pivot mode"
          className="h-8 text-xs"
        >
          Pivot
        </Toggle>

        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenColumnChooser}
          className="h-8"
        >
          <Columns3 className="size-3.5" />
          <span className="sr-only">Column chooser</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="size-3.5" />
              <span className="sr-only">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="mr-2 size-3.5" />
              Export to Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCsv}>
              <FileText className="mr-2 size-3.5" />
              Export to CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCopyToClipboard}>
              <Clipboard className="mr-2 size-3.5" />
              Copy to Clipboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
