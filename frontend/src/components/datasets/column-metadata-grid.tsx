import { useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, CellValueChangedEvent, ICellRendererParams } from 'ag-grid-community'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/layout/theme-provider'
import { cn } from '@/lib/utils'
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

function NameCellRenderer(
  params: ICellRendererParams<MergedColumn> & { onDismissMissing?: (name: string) => void },
) {
  const data = params.data
  if (!data) return null

  if (data.status === 'missing') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs truncate">{data.name}</span>
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

  return <span className="font-mono text-xs">{data.name}</span>
}

export function ColumnMetadataGrid({ columns, onChange }: ColumnMetadataGridProps) {
  const { resolvedTheme } = useTheme()
  const themeClass = resolvedTheme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'

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
        width: 120,
        editable: false,
        cellRenderer: NameCellRenderer,
        cellRendererParams: {
          onDismissMissing: handleDismissMissing,
        },
      },
      {
        field: 'displayName',
        headerName: 'Display Name',
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
      },
      {
        field: 'role',
        headerName: 'Role',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ROLES,
        },
      },
      {
        field: 'aggregation',
        headerName: 'Aggregation',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: AGGREGATIONS,
        },
      },
      {
        field: 'formatPreset',
        headerName: 'Format',
        flex: 1,
        minWidth: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: FORMAT_VALUES,
        },
        valueFormatter: (params) => {
          const preset = FORMAT_PRESETS.find((p) => p.id === params.value)
          return preset ? preset.label : String(params.value ?? '')
        },
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

  const getRowStyle = useCallback(
    (params: { data?: MergedColumn }) => {
      if (!params.data) return undefined

      if (params.data.status === 'missing') {
        return resolvedTheme === 'dark'
          ? { backgroundColor: 'rgba(127, 29, 29, 0.2)' }
          : { backgroundColor: 'rgb(254, 242, 242)' }
      }

      if (params.data.status === 'new') {
        return resolvedTheme === 'dark'
          ? { backgroundColor: 'rgba(20, 83, 45, 0.2)' }
          : { backgroundColor: 'rgb(240, 253, 244)' }
      }

      return undefined
    },
    [resolvedTheme],
  )

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<MergedColumn>) => {
      if (!event.data) return
      const updated = columns.map((col) => {
        if (col.name === event.data!.name) {
          return { ...col, [event.colDef.field as string]: event.newValue }
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
      className={cn(themeClass, useAutoHeight ? 'w-full' : 'w-full h-full')}
    >
      <AgGridReact<MergedColumn>
        rowData={columns}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowStyle={getRowStyle}
        onCellValueChanged={onCellValueChanged}
        domLayout={useAutoHeight ? 'autoHeight' : 'normal'}
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        getRowId={(params) => params.data.name}
      />
    </div>
  )
}
