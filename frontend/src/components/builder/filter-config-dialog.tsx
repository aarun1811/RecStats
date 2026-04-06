import { useCallback, useMemo, useState } from 'react'

import { ChevronDown, ChevronRight, Database } from 'lucide-react'

import {
  FilterColumnMapper,
  type ChartColumnMapping,
} from '@/components/builder/filter-column-mapper'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import { useBuilderStore } from '@/stores/builder-store'
import type { FilterConfig, FilterOptionsSource } from '@/types/dashboard-config'
import type { DatasetColumnMeta, RecvizDataset } from '@/types/managed-dataset'

type FilterType = FilterConfig['type']

interface FilterConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFiltersAdded: (filters: FilterConfig[]) => void
}

interface SelectedColumn {
  datasetId: string
  column: DatasetColumnMeta
  filterType: FilterType
  dependsOn: string | null
  columnMappings: Record<string, string | null>
}

function detectFilterType(col: DatasetColumnMeta): FilterType {
  if (col.dataType === 'date' || col.role === 'time') {
    return 'preset-range'
  }
  if (
    (col.dataType === 'number' || col.dataType === 'currency') &&
    col.role === 'measure'
  ) {
    return 'preset-range'
  }
  // string or dimension
  return 'multi-select'
}

function filterTypeBadgeLabel(type: FilterType): string {
  switch (type) {
    case 'single-select':
      return 'Single Select'
    case 'multi-select':
      return 'Multi Select'
    case 'preset-range':
      return 'Preset Range'
  }
}

export function FilterConfigDialog({
  open,
  onOpenChange,
  onFiltersAdded,
}: FilterConfigDialogProps) {
  const items = useBuilderStore((s) => s.items)
  const existingFilters = useBuilderStore((s) => s.filters)
  const { data: allDatasets } = useManagedDatasets()

  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([])
  const [expandedDatasets, setExpandedDatasets] = useState<Set<string>>(
    new Set(),
  )

  // Gather unique dataset IDs from builder items
  const usedDatasetIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items) {
      if (item.type === 'chart' && item.chart?.datasetId) {
        ids.add(item.chart.datasetId)
      }
      if (item.type === 'grid' && item.grid?.datasetId) {
        ids.add(item.grid.datasetId)
      }
    }
    return ids
  }, [items])

  // Filter loaded datasets to only those used on the dashboard
  const usedDatasets = useMemo(() => {
    if (!allDatasets) return []
    return allDatasets.filter((ds) => usedDatasetIds.has(ds.id))
  }, [allDatasets, usedDatasetIds])

  // Track already-added filter columns to grey them out
  const existingFilterColumns = useMemo(() => {
    const cols = new Set<string>()
    for (const f of existingFilters) {
      if (f.optionsSource?.valueColumn) {
        cols.add(
          `${f.optionsSource.dataSourceId}::${f.optionsSource.valueColumn}`,
        )
      }
    }
    return cols
  }, [existingFilters])

  // Build chart mappings for a given column
  const buildChartMappings = useCallback(
    (
      columnName: string,
      currentMappings: Record<string, string | null>,
    ): ChartColumnMapping[] => {
      const mappings: ChartColumnMapping[] = []
      for (const item of items) {
        let datasetId = ''
        let title = ''
        if (item.type === 'chart' && item.chart) {
          datasetId = item.chart.datasetId
          title = item.chart.title || 'Untitled Chart'
        } else if (item.type === 'grid' && item.grid) {
          datasetId = item.grid.datasetId
          title = item.grid.title || 'Untitled Grid'
        } else {
          continue
        }

        const dataset = allDatasets?.find((ds) => ds.id === datasetId)
        const availableColumns =
          dataset?.columns.map((c) => c.name) ?? []
        const autoMatch = availableColumns.includes(columnName)
        const override = currentMappings[item.id]
        const matchedColumn =
          override !== undefined ? override : autoMatch ? columnName : null

        mappings.push({
          chartItemId: item.id,
          chartTitle: title,
          datasetId,
          matchedColumn,
          availableColumns,
        })
      }
      return mappings
    },
    [items, allDatasets],
  )

  const toggleDatasetExpanded = useCallback((datasetId: string) => {
    setExpandedDatasets((prev) => {
      const next = new Set(prev)
      if (next.has(datasetId)) {
        next.delete(datasetId)
      } else {
        next.add(datasetId)
      }
      return next
    })
  }, [])

  const isColumnSelected = useCallback(
    (datasetId: string, columnName: string) => {
      return selectedColumns.some(
        (sc) => sc.datasetId === datasetId && sc.column.name === columnName,
      )
    },
    [selectedColumns],
  )

  const toggleColumn = useCallback(
    (dataset: RecvizDataset, column: DatasetColumnMeta) => {
      setSelectedColumns((prev) => {
        const exists = prev.find(
          (sc) => sc.datasetId === dataset.id && sc.column.name === column.name,
        )
        if (exists) {
          return prev.filter(
            (sc) =>
              !(sc.datasetId === dataset.id && sc.column.name === column.name),
          )
        }
        return [
          ...prev,
          {
            datasetId: dataset.id,
            column,
            filterType: detectFilterType(column),
            dependsOn: null,
            columnMappings: {},
          },
        ]
      })
    },
    [],
  )

  const updateFilterType = useCallback(
    (datasetId: string, columnName: string, type: FilterType) => {
      setSelectedColumns((prev) =>
        prev.map((sc) =>
          sc.datasetId === datasetId && sc.column.name === columnName
            ? { ...sc, filterType: type }
            : sc,
        ),
      )
    },
    [],
  )

  const updateDependsOn = useCallback(
    (datasetId: string, columnName: string, dependsOn: string | null) => {
      setSelectedColumns((prev) =>
        prev.map((sc) =>
          sc.datasetId === datasetId && sc.column.name === columnName
            ? { ...sc, dependsOn }
            : sc,
        ),
      )
    },
    [],
  )

  const updateColumnMapping = useCallback(
    (
      datasetId: string,
      columnName: string,
      chartItemId: string,
      mappedColumn: string | null,
    ) => {
      setSelectedColumns((prev) =>
        prev.map((sc) =>
          sc.datasetId === datasetId && sc.column.name === columnName
            ? {
                ...sc,
                columnMappings: {
                  ...sc.columnMappings,
                  [chartItemId]: mappedColumn,
                },
              }
            : sc,
        ),
      )
    },
    [],
  )

  const handleAddFilters = useCallback(() => {
    const filters: FilterConfig[] = selectedColumns.map((sc) => {
      const dependsOnRecord: Record<string, string> = {}
      if (sc.dependsOn) {
        // Find the dependent column info
        const depColumn = selectedColumns.find(
          (other) =>
            `${other.datasetId}::${other.column.name}` === sc.dependsOn,
        )
        if (depColumn) {
          dependsOnRecord[sc.dependsOn] = depColumn.column.name
        }
      }

      const optionsSource: FilterOptionsSource = {
        dataSourceId: sc.datasetId,
        valueColumn: sc.column.name,
        dependsOn: dependsOnRecord,
      }

      return {
        id: crypto.randomUUID(),
        label: sc.column.displayName || sc.column.name,
        type: sc.filterType,
        lockable: false,
        optionsSource,
      }
    })

    onFiltersAdded(filters)
    setSelectedColumns([])
    onOpenChange(false)
  }, [selectedColumns, onFiltersAdded, onOpenChange])

  // Other selected columns that can be listed as cascading parents
  const availableDependsOnOptions = useMemo(() => {
    return selectedColumns.map((sc) => ({
      key: `${sc.datasetId}::${sc.column.name}`,
      label: sc.column.displayName || sc.column.name,
    }))
  }, [selectedColumns])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Filters</DialogTitle>
          <DialogDescription>
            Select columns from datasets used on this dashboard to create
            filters.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1 pr-4">
            {usedDatasets.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Add charts or grids to the dashboard first to configure filters.
              </p>
            )}
            {usedDatasets.map((dataset) => (
              <DatasetSection
                key={dataset.id}
                dataset={dataset}
                expanded={expandedDatasets.has(dataset.id)}
                onToggleExpand={() => toggleDatasetExpanded(dataset.id)}
                isColumnSelected={isColumnSelected}
                existingFilterColumns={existingFilterColumns}
                selectedColumns={selectedColumns}
                availableDependsOnOptions={availableDependsOnOptions}
                buildChartMappings={buildChartMappings}
                onToggleColumn={toggleColumn}
                onUpdateFilterType={updateFilterType}
                onUpdateDependsOn={updateDependsOn}
                onUpdateColumnMapping={updateColumnMapping}
              />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            onClick={handleAddFilters}
            disabled={selectedColumns.length === 0}
          >
            Add {selectedColumns.length > 0 ? selectedColumns.length : ''}{' '}
            Filter{selectedColumns.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dataset Section (expandable)
// ---------------------------------------------------------------------------

interface DatasetSectionProps {
  dataset: RecvizDataset
  expanded: boolean
  onToggleExpand: () => void
  isColumnSelected: (datasetId: string, columnName: string) => boolean
  existingFilterColumns: Set<string>
  selectedColumns: SelectedColumn[]
  availableDependsOnOptions: Array<{ key: string; label: string }>
  buildChartMappings: (
    columnName: string,
    currentMappings: Record<string, string | null>,
  ) => ChartColumnMapping[]
  onToggleColumn: (dataset: RecvizDataset, column: DatasetColumnMeta) => void
  onUpdateFilterType: (
    datasetId: string,
    columnName: string,
    type: FilterType,
  ) => void
  onUpdateDependsOn: (
    datasetId: string,
    columnName: string,
    dependsOn: string | null,
  ) => void
  onUpdateColumnMapping: (
    datasetId: string,
    columnName: string,
    chartItemId: string,
    mappedColumn: string | null,
  ) => void
}

function DatasetSection({
  dataset,
  expanded,
  onToggleExpand,
  isColumnSelected,
  existingFilterColumns,
  selectedColumns,
  availableDependsOnOptions,
  buildChartMappings,
  onToggleColumn,
  onUpdateFilterType,
  onUpdateDependsOn,
  onUpdateColumnMapping,
}: DatasetSectionProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted"
      >
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <Database className="size-4 text-muted-foreground" />
        <span className="truncate">{dataset.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {dataset.columns.length} columns
        </span>
      </button>

      {expanded && (
        <div className="ml-4 space-y-0.5 pb-2 pl-4">
          {dataset.columns.map((col) => {
            const alreadyAdded = existingFilterColumns.has(
              `${dataset.id}::${col.name}`,
            )
            const isSelected = isColumnSelected(dataset.id, col.name)
            const selectedCol = selectedColumns.find(
              (sc) =>
                sc.datasetId === dataset.id && sc.column.name === col.name,
            )

            return (
              <div key={col.name}>
                <ColumnRow
                  dataset={dataset}
                  column={col}
                  isSelected={isSelected}
                  alreadyAdded={alreadyAdded}
                  filterType={selectedCol?.filterType}
                  dependsOn={selectedCol?.dependsOn ?? null}
                  availableDependsOnOptions={availableDependsOnOptions.filter(
                    (opt) => opt.key !== `${dataset.id}::${col.name}`,
                  )}
                  onToggle={() => onToggleColumn(dataset, col)}
                  onUpdateFilterType={(type) =>
                    onUpdateFilterType(dataset.id, col.name, type)
                  }
                  onUpdateDependsOn={(dep) =>
                    onUpdateDependsOn(dataset.id, col.name, dep)
                  }
                />
                {isSelected && selectedCol && (
                  <div className="ml-6 pb-2">
                    <FilterColumnMapper
                      filterColumnName={col.name}
                      chartMappings={buildChartMappings(
                        col.name,
                        selectedCol.columnMappings,
                      )}
                      onMappingChange={(chartItemId, mappedCol) =>
                        onUpdateColumnMapping(
                          dataset.id,
                          col.name,
                          chartItemId,
                          mappedCol,
                        )
                      }
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Separator />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column Row
// ---------------------------------------------------------------------------

interface ColumnRowProps {
  dataset: RecvizDataset
  column: DatasetColumnMeta
  isSelected: boolean
  alreadyAdded: boolean
  filterType: FilterType | undefined
  dependsOn: string | null
  availableDependsOnOptions: Array<{ key: string; label: string }>
  onToggle: () => void
  onUpdateFilterType: (type: FilterType) => void
  onUpdateDependsOn: (dependsOn: string | null) => void
}

function ColumnRow({
  column,
  isSelected,
  alreadyAdded,
  filterType,
  dependsOn,
  availableDependsOnOptions,
  onToggle,
  onUpdateFilterType,
  onUpdateDependsOn,
}: ColumnRowProps) {
  const detectedType = detectFilterType(column)
  const displayType = filterType ?? detectedType

  return (
    <div className="space-y-2 rounded px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          disabled={alreadyAdded}
        />
        <span className={`flex-1 text-sm ${alreadyAdded ? 'text-muted-foreground line-through' : ''}`}>
          {column.displayName || column.name}
        </span>
        <Badge variant="secondary" className="text-xs">
          {filterTypeBadgeLabel(displayType)}
        </Badge>
      </div>

      {isSelected && (
        <div className="ml-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Type:</span>
            <Select
              value={displayType}
              onValueChange={(v) => onUpdateFilterType(v as FilterType)}
            >
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single-select">Single Select</SelectItem>
                <SelectItem value="multi-select">Multi Select</SelectItem>
                <SelectItem value="preset-range">Preset Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Depends on:</span>
            <Select
              value={dependsOn ?? '__none__'}
              onValueChange={(v) =>
                onUpdateDependsOn(v === '__none__' ? null : v)
              }
            >
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {availableDependsOnOptions.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
