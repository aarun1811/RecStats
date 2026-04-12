import { useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { type ColDef, type CellValueChangedEvent, type ICellRendererParams, themeQuartz, colorSchemeDark } from 'ag-grid-community'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/layout/theme-provider'
import { cn } from '@/lib/utils'
import { RoleBadgeRenderer } from './role-badge-renderer'
import { TypeBadgeRenderer } from './type-badge-renderer'
import { ColumnHeaderWithTooltip } from './column-header-with-tooltip'

import type { MergedColumn } from '@/lib/column-merge'
import type {
  AggregationFunction,
  ColumnDataType,
  ColumnRole,
  FormatPreset,
} from '@/types/managed-dataset'
import { FORMAT_PRESETS } from '@/components/datasets/format-preset-select'

interface ColumnMetadataGridProps {
  columns: MergedColumn[]
  onChange: (columns: MergedColumn[]) => void
}

const DATA_TYPES: ColumnDataType[] = ['string', 'number', 'date', 'currency']
const ROLES: ColumnRole[] = ['dimension', 'measure', 'time', 'none']
const AGGREGATIONS: AggregationFunction[] = [
  'NONE',
  'SUM',
  'AVG',
  'COUNT',
  'MIN',
  'MAX',
  'COUNT_DISTINCT',
]
const FORMAT_VALUES: FormatPreset[] = FORMAT_PRESETS.map((p) => p.id)

// --- Cell renderer: Name column with status badges ---

function NameCellRenderer(
  params: ICellRendererParams<MergedColumn> & { onDismissMissing?: (name: string) => void },
) {
  const data = params.data
  if (!data) return null

  if (data.status === 'missing') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs truncate line-through text-muted-foreground">{data.name}</span>
        <Badge variant="destructive" className="h-4 px-1 text-[10px] shrink-0">
          Missing
        </Badge>
        {params.onDismissMissing && (
          <Button
            variant="ghost"
            size="sm"
            className="size-4 p-0 shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              params.onDismissMissing?.(data.name)
            }}
          >
            <X className="size-3" />
          </Button>
        )}
      </div>
    )
  }

  if (data.status === 'new') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs truncate">{data.name}</span>
        <Badge variant="outline" className="h-4 px-1 text-[10px] shrink-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
          New
        </Badge>
      </div>
    )
  }

  return <span className="font-mono text-xs">{data.name}</span>
}

export function ColumnMetadataGrid({ columns, onChange }: ColumnMetadataGridProps) {
  const { resolvedTheme } = useTheme()
  const gridTheme = resolvedTheme === 'dark' ? themeQuartz.withPart(colorSchemeDark) : themeQuartz

  const handleDismissMissing = useCallback(
    (name: string) => {
      onChange(columns.filter((c) => c.name !== name))
    },
    [columns, onChange],
  )

  const columnDefs = useMemo<ColDef<MergedColumn>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        width: 130,
        editable: false,
        cellRenderer: NameCellRenderer,
        cellRendererParams: {
          onDismissMissing: handleDismissMissing,
        },
      },
      {
        field: 'displayName',
        headerName: 'Display',
        width: 140,
        editable: true,
      },
      {
        field: 'dataType',
        headerName: 'Type',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: DATA_TYPES,
        },
        cellRenderer: TypeBadgeRenderer,
        headerComponent: ColumnHeaderWithTooltip,
        headerComponentParams: { tooltipField: 'Type' },
      },
      {
        field: 'role',
        headerName: 'Role',
        width: 110,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ROLES,
        },
        cellRenderer: RoleBadgeRenderer,
        headerComponent: ColumnHeaderWithTooltip,
        headerComponentParams: { tooltipField: 'Role' },
      },
      {
        field: 'aggregation',
        headerName: 'Agg',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: AGGREGATIONS,
        },
        cellClass: 'text-xs font-mono',
        headerComponent: ColumnHeaderWithTooltip,
        headerComponentParams: { tooltipField: 'Aggregation' },
      },
      {
        field: 'formatPreset',
        headerName: 'Format',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: FORMAT_VALUES,
        },
        valueFormatter: (params) => {
          const preset = FORMAT_PRESETS.find((p) => p.id === params.value)
          return preset ? preset.label : String(params.value ?? '')
        },
        headerComponent: ColumnHeaderWithTooltip,
        headerComponentParams: { tooltipField: 'Format' },
      },
    ],
    [handleDismissMissing],
  )

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      suppressMovable: true,
    }),
    [],
  )

  const getRowClass = useCallback(
    (params: { data?: MergedColumn }) => {
      if (!params.data) return ''
      if (params.data.status === 'missing') return 'bg-red-50 dark:bg-red-950/20 border-l-2 border-l-red-500'
      if (params.data.status === 'new') return 'bg-green-50 dark:bg-green-950/20 border-l-2 border-l-green-500'
      return ''
    },
    [],
  )

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<MergedColumn>) => {
      if (!event.data || !event.colDef.field) return
      const field = event.colDef.field
      const updated = columns.map((col) => {
        if (col.name === event.data!.name) {
          return { ...col, [field]: event.newValue }
        }
        return col
      })
      onChange(updated)
    },
    [columns, onChange],
  )

  const useAutoHeight = columns.length <= 10

  return (
    <div
      className={cn(useAutoHeight ? 'w-full' : 'w-full h-full')}
    >
      <AgGridReact<MergedColumn>
        theme={gridTheme}
        rowData={columns}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowClass={getRowClass}
        onCellValueChanged={onCellValueChanged}
        domLayout={useAutoHeight ? 'autoHeight' : 'normal'}
        rowHeight={36}
        headerHeight={36}
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        getRowId={(params) => params.data.name}
      />
    </div>
  )
}
