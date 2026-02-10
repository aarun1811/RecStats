import { useCallback, useMemo, useRef, useState } from 'react'

import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  IRowNode,
  IsExternalFilterPresentParams,
  RowClickedEvent,
  SideBarDef,
} from 'ag-grid-community'
import { ModuleRegistry, themeQuartz, colorSchemeVariable } from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import { AgGridReact } from 'ag-grid-react'

import { useFilterStore } from '@/stores/filter-store'
import { useThemeStore } from '@/stores/theme-store'
import { defaultGridOptions } from '@/lib/ag-grid-config'
import { Skeleton } from '@/components/ui/skeleton'

import '@/lib/ag-grid-theme.css'

ModuleRegistry.registerModules([AllEnterpriseModule])

const gridTheme = themeQuartz.withPart(colorSchemeVariable)

interface DataGridProps<TData = Record<string, unknown>> {
  columns: ColDef<TData>[]
  data: TData[]
  loading?: boolean
  onRowClick?: (event: RowClickedEvent<TData>) => void
  enablePivot?: boolean
  enableGrouping?: boolean
  enableMasterDetail?: boolean
  detailCellRenderer?: React.ComponentType<unknown>
  externalFilter?: boolean
  pivotMode?: boolean
  quickFilterText?: string
  onGridReady?: (api: GridApi<TData>) => void
}

export function DataGrid<TData = Record<string, unknown>>({
  columns,
  data,
  loading = false,
  onRowClick,
  enablePivot = false,
  enableGrouping = true,
  enableMasterDetail = false,
  detailCellRenderer,
  externalFilter = true,
  pivotMode = false,
  quickFilterText,
  onGridReady,
}: DataGridProps<TData>) {
  const gridRef = useRef<AgGridReact<TData>>(null)
  const [_api, setApi] = useState<GridApi<TData> | null>(null)
  const crossFilters = useFilterStore((s) => s.crossFilters)
  const theme = useThemeStore((s) => s.theme)

  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme
  }, [theme])

  const sideBar = useMemo<SideBarDef | undefined>(() => {
    if (!enableGrouping && !enablePivot) return undefined
    return {
      toolPanels: [
        {
          id: 'columns',
          labelDefault: 'Columns',
          labelKey: 'columns',
          iconKey: 'columns',
          toolPanel: 'agColumnsToolPanel',
          toolPanelParams: {
            suppressRowGroups: !enableGrouping,
            suppressValues: !enablePivot,
            suppressPivots: !enablePivot,
            suppressPivotMode: !enablePivot,
          },
        },
        {
          id: 'filters',
          labelDefault: 'Filters',
          labelKey: 'filters',
          iconKey: 'filter',
          toolPanel: 'agFiltersToolPanel',
        },
      ],
      defaultToolPanel: '',
    }
  }, [enableGrouping, enablePivot])

  const isExternalFilterPresent = useCallback(
    (_params: IsExternalFilterPresentParams) => {
      if (!externalFilter) return false
      return Object.keys(crossFilters).length > 0
    },
    [crossFilters, externalFilter],
  )

  const doesExternalFilterPass = useCallback(
    (node: IRowNode<TData>) => {
      if (!externalFilter || Object.keys(crossFilters).length === 0) return true
      const rowData = node.data
      if (!rowData) return true

      for (const filter of Object.values(crossFilters)) {
        const cellValue = String(
          (rowData as Record<string, unknown>)[filter.field] ?? '',
        )
        const filterValues = Array.isArray(filter.value)
          ? filter.value
          : [filter.value]
        if (!filterValues.includes(cellValue)) return false
      }
      return true
    },
    [crossFilters, externalFilter],
  )

  const handleGridReady = useCallback(
    (event: GridReadyEvent<TData>) => {
      setApi(event.api)
      onGridReady?.(event.api)
    },
    [onGridReady],
  )

  const containerClass = useMemo(
    () =>
      resolvedTheme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz',
    [resolvedTheme],
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-0">
        {/* Header skeleton */}
        <Skeleton className="h-9 w-full rounded-none" />
        {/* Row skeletons */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[34px] w-full rounded-none"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`${containerClass} flex-1`} style={{ minHeight: 300 }}>
      <AgGridReact<TData>
        ref={gridRef}
        theme={gridTheme}
        columnDefs={columns}
        rowData={data}
        {...defaultGridOptions}
        pivotMode={pivotMode}
        masterDetail={enableMasterDetail}
        detailCellRenderer={detailCellRenderer}
        enableRangeSelection
        enableCharts={false}
        rowGroupPanelShow={enableGrouping ? 'onlyWhenGrouping' : 'never'}
        sideBar={sideBar}
        quickFilterText={quickFilterText}
        isExternalFilterPresent={isExternalFilterPresent}
        doesExternalFilterPass={doesExternalFilterPass}
        onGridReady={handleGridReady}
        onRowClicked={onRowClick}
        domLayout="autoHeight"
        suppressMenuHide
      />
    </div>
  )
}
