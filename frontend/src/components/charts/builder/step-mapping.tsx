import { HelpCircle, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LibraryChartType, ChartColumnMapping } from '@/types/managed-chart'
import type { DatasetColumnMeta, AggregationFunction } from '@/types/managed-dataset'

interface MappingFieldConfig {
  categoryLabel: string
  metricLabel: string
  secondaryDimLabel?: string
  multiMetric: boolean
  minMetrics?: number
}

const MAPPING_FIELD_LABELS: Record<string, MappingFieldConfig> = {
  'bar':         { categoryLabel: 'X-Axis',    metricLabel: 'Metrics',      multiMetric: true },
  'stacked-bar': { categoryLabel: 'X-Axis',    metricLabel: 'Metrics',      multiMetric: true },
  'line':        { categoryLabel: 'X-Axis',    metricLabel: 'Metrics',      multiMetric: true },
  'area':        { categoryLabel: 'X-Axis',    metricLabel: 'Metrics',      multiMetric: true },
  'pie':         { categoryLabel: 'Category',  metricLabel: 'Metric',       multiMetric: false },
  'donut':       { categoryLabel: 'Category',  metricLabel: 'Metric',       multiMetric: false },
  'scatter':     { categoryLabel: 'X-Metric',  metricLabel: 'Y-Metric',     multiMetric: false },
  'heatmap':     { categoryLabel: 'X-Axis',    metricLabel: 'Color Metric', secondaryDimLabel: 'Y-Axis', multiMetric: false },
  'treemap':     { categoryLabel: 'Category',  metricLabel: 'Metric',       multiMetric: false },
  'waterfall':   { categoryLabel: 'Category',  metricLabel: 'Metric',       multiMetric: false },
  'bullet':      { categoryLabel: 'Category',  metricLabel: 'Metric',       multiMetric: false },
  'box-plot':    { categoryLabel: 'Category',  metricLabel: 'Value',        multiMetric: false },
  'combo':       { categoryLabel: 'X-Axis',    metricLabel: 'Metrics',      multiMetric: true, minMetrics: 2 },
  'sankey':      { categoryLabel: 'Source',     metricLabel: 'Value',        secondaryDimLabel: 'Target', multiMetric: false },
  'sunburst':    { categoryLabel: 'Levels',    metricLabel: 'Value',        multiMetric: false },
  'radar':       { categoryLabel: 'Category',  metricLabel: 'Metrics',      multiMetric: true, minMetrics: 2 },
  'graph':       { categoryLabel: 'Source',     metricLabel: 'Weight',       secondaryDimLabel: 'Target', multiMetric: false },
  'gauge':       { categoryLabel: '',           metricLabel: 'Metric',       multiMetric: false },
  'parallel':    { categoryLabel: 'Category',  metricLabel: 'Metrics',      multiMetric: true, minMetrics: 2 },
  'funnel':      { categoryLabel: 'Category',  metricLabel: 'Metric',       multiMetric: false },
}

const AGGREGATION_OPTIONS: AggregationFunction[] = [
  'NONE', 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT',
]

const MAPPING_FIELD_TOOLTIPS: Record<string, Record<string, string>> = {
  'bar': {
    'X-Axis': 'The category axis. Each unique value becomes a bar group.',
    'Metrics': 'Numeric columns to plot. Each metric becomes a separate bar series.',
  },
  'stacked-bar': {
    'X-Axis': 'The category axis. Each unique value becomes a stacked group.',
    'Metrics': 'Numeric columns to stack. Each metric becomes a segment in the bar.',
  },
  'line': {
    'X-Axis': 'The horizontal axis. Typically a time or ordered category column.',
    'Metrics': 'Numeric columns. Each becomes a separate line on the chart.',
  },
  'area': {
    'X-Axis': 'The horizontal axis. Typically a time or ordered category.',
    'Metrics': 'Numeric columns. Each becomes a filled area beneath its line.',
  },
  'pie': {
    'Category': 'Dimension column. Each unique value becomes a slice of the pie.',
    'Metric': 'Single numeric column determining the size of each slice.',
  },
  'donut': {
    'Category': 'Dimension column. Each unique value becomes a segment.',
    'Metric': 'Single numeric column determining segment size.',
  },
  'scatter': {
    'X-Metric': 'The numeric column for the horizontal position of each point.',
    'Y-Metric': 'The numeric column for the vertical position of each point.',
  },
  'heatmap': {
    'X-Axis': 'The primary dimension. Columns of the heatmap grid.',
    'Y-Axis': 'The secondary dimension. Rows in the heatmap grid.',
    'Color Metric': 'Numeric column whose values determine cell color intensity.',
  },
  'treemap': {
    'Category': 'Dimension column used as rectangle labels in the treemap.',
    'Metric': 'Numeric column determining the size of each rectangle.',
  },
  'waterfall': {
    'Category': 'Step labels along the x-axis (e.g., line items).',
    'Metric': 'Numeric column. Positive values increase, negative values decrease.',
  },
  'bullet': {
    'Category': 'Label for each bullet row.',
    'Metric': 'The actual performance value to display as a bar.',
  },
  'box-plot': {
    'Category': 'Grouping dimension for each box in the plot.',
    'Value': 'Numeric column. Distribution (min, Q1, median, Q3, max) computed per category.',
  },
  'combo': {
    'X-Axis': 'Shared category axis for both bar and line series.',
    'Metrics': 'Two or more metrics. First renders as bars, second as a line.',
  },
  'sankey': {
    'Source': 'Start node for each flow connection.',
    'Target': 'End node for each flow connection.',
    'Value': 'Numeric weight determining link thickness.',
  },
  'sunburst': {
    'Levels': 'Hierarchical category column defining concentric rings.',
    'Value': 'Numeric column determining arc size at each level.',
  },
  'radar': {
    'Category': 'Indicator labels around the radar perimeter.',
    'Metrics': 'Two or more numeric columns. Each becomes a radar axis.',
  },
  'gauge': {
    'Metric': 'Single numeric value to display on the gauge dial.',
  },
  'funnel': {
    'Category': 'Stage labels in the funnel from widest to narrowest.',
    'Metric': 'Numeric column determining each stage width.',
  },
  'graph': {
    'Source': 'Source node for each edge in the network.',
    'Target': 'Target node for each edge.',
    'Weight': 'Numeric weight of each edge connection.',
  },
  'parallel': {
    'Category': 'Grouping dimension for color-coding lines.',
    'Metrics': 'Two or more numeric columns. Each becomes a parallel axis.',
  },
}

// ---------------------------------------------------------------------------

interface StepMappingProps {
  chartType: LibraryChartType
  columns: DatasetColumnMeta[]
  mapping: ChartColumnMapping
  onChange: (mapping: ChartColumnMapping) => void
}

export function StepMapping({ chartType, columns, mapping, onChange }: StepMappingProps) {
  const fieldConfig = MAPPING_FIELD_LABELS[chartType] ?? {
    categoryLabel: 'Category',
    metricLabel: 'Metric',
    multiMetric: false,
  }

  const isScatter = chartType === 'scatter'

  const dimensionColumns = columns.filter(
    (c) => c.role === 'dimension' || c.role === 'time',
  )
  const measureColumns = columns.filter((c) => c.role === 'measure')

  // For scatter, both dropdowns use measure columns
  const categoryOptions = isScatter ? measureColumns : dimensionColumns
  // Allow all columns as override options
  const allOtherDimensions = columns.filter(
    (c) => !categoryOptions.some((o) => o.name === c.name),
  )

  function updateCategoryColumn(value: string) {
    onChange({ ...mapping, categoryColumn: value })
  }

  function updateSecondaryDim(value: string) {
    // Store secondary dimension in metricColumns as a convention for heatmap/sankey/graph
    // The first metric column for these types holds the secondary dimension
    // Actually for heatmap/sankey/graph, the secondary dim should be stored differently.
    // We store it in metricColumns[0] position since these chart types use categoryColumn (primary dim),
    // a secondary dimension encoded in the mapping, and a value metric.
    // For simplicity, we encode secondary dim in categoryColumn with a separator or use
    // a convention: categoryColumn = primary, metricColumns = [secondaryDim, valueMetric]
    // However, ChartColumnMapping doesn't have a secondaryDim field.
    // Best approach: store "secondaryDimColumn" as categoryColumn's companion.
    // Since the type doesn't have it, we'll store the second dimension as the first element
    // of metricColumns and shift the actual metric. Wait -- that breaks the model.
    // Let's keep it clean: we put secondary dim in aggregations with a special key.
    // Actually the simplest: we store it directly. For heatmap: categoryColumn = x-axis dim,
    // and we need y-axis dim. We can use metricColumns[0] for y-axis dim and metricColumns[1] for the color metric.
    // This is consistent with how buildSeries in ag-chart-wrapper works.
    // For sankey/graph: categoryColumn = source, metricColumns[0] = target, metricColumns[1] = value/weight.
    // This is a practical encoding within the existing ChartColumnMapping interface.
    const newMetricColumns = [...mapping.metricColumns]
    newMetricColumns[0] = value
    onChange({ ...mapping, metricColumns: newMetricColumns })
  }

  function addMetric(columnName: string) {
    if (mapping.metricColumns.includes(columnName)) return
    const col = columns.find((c) => c.name === columnName)
    const defaultAgg = col?.aggregation ?? 'NONE'
    onChange({
      ...mapping,
      metricColumns: [...mapping.metricColumns, columnName],
      aggregations: {
        ...mapping.aggregations,
        [columnName]: defaultAgg,
      },
    })
  }

  function removeMetric(columnName: string) {
    const newAggs = { ...mapping.aggregations }
    delete newAggs[columnName]
    onChange({
      ...mapping,
      metricColumns: mapping.metricColumns.filter((c) => c !== columnName),
      aggregations: newAggs,
    })
  }

  function updateAggregation(columnName: string, agg: string) {
    onChange({
      ...mapping,
      aggregations: { ...mapping.aggregations, [columnName]: agg },
    })
  }

  // For types with secondaryDimLabel (heatmap, sankey, graph):
  // metricColumns[0] = secondary dimension, metricColumns[1+] = actual metrics
  const hasSecondaryDim = Boolean(fieldConfig.secondaryDimLabel)
  const secondaryDimValue = hasSecondaryDim ? mapping.metricColumns[0] ?? '' : ''
  const actualMetrics = hasSecondaryDim
    ? mapping.metricColumns.slice(1)
    : mapping.metricColumns

  function handleAddMetricForSecondary(columnName: string) {
    if (mapping.metricColumns.includes(columnName)) return
    const col = columns.find((c) => c.name === columnName)
    const defaultAgg = col?.aggregation ?? 'NONE'
    // If secondary dim exists, actual metrics start at index 1
    onChange({
      ...mapping,
      metricColumns: [...mapping.metricColumns, columnName],
      aggregations: {
        ...mapping.aggregations,
        [columnName]: defaultAgg,
      },
    })
  }

  function handleRemoveMetricForSecondary(columnName: string) {
    const newAggs = { ...mapping.aggregations }
    delete newAggs[columnName]
    onChange({
      ...mapping,
      metricColumns: mapping.metricColumns.filter((c) => c !== columnName),
      aggregations: newAggs,
    })
  }

  // Available metrics not yet selected
  const availableMetrics = measureColumns.filter(
    (c) => !(hasSecondaryDim ? mapping.metricColumns.slice(1) : mapping.metricColumns).includes(c.name),
  )
  const availableAllMetrics = columns.filter(
    (c) =>
      !measureColumns.some((m) => m.name === c.name) &&
      !(hasSecondaryDim ? mapping.metricColumns.slice(1) : mapping.metricColumns).includes(c.name),
  )

  return (
    <div className="space-y-4">
      {/* Primary dimension / category */}
      {fieldConfig.categoryLabel && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-semibold">{fieldConfig.categoryLabel}</Label>
            {MAPPING_FIELD_TOOLTIPS[chartType]?.[fieldConfig.categoryLabel] && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-xs text-sm">
                  {MAPPING_FIELD_TOOLTIPS[chartType][fieldConfig.categoryLabel]}
                </PopoverContent>
              </Popover>
            )}
          </div>
          <Select
            value={mapping.categoryColumn ?? ''}
            onValueChange={updateCategoryColumn}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${fieldConfig.categoryLabel.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.length > 0 && (
                <>
                  {categoryOptions.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      <span className="flex items-center gap-2">
                        {col.displayName || col.name}
                        <span className="text-xs text-muted-foreground">({col.role})</span>
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
              {allOtherDimensions.length > 0 && (
                <>
                  {allOtherDimensions.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      <span className="flex items-center gap-2">
                        {col.displayName || col.name}
                        <span className="text-xs text-muted-foreground">({col.role})</span>
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Secondary dimension (heatmap Y-Axis, sankey Target, graph Target) */}
      {fieldConfig.secondaryDimLabel && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-semibold">{fieldConfig.secondaryDimLabel}</Label>
            {MAPPING_FIELD_TOOLTIPS[chartType]?.[fieldConfig.secondaryDimLabel] && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-xs text-sm">
                  {MAPPING_FIELD_TOOLTIPS[chartType][fieldConfig.secondaryDimLabel]}
                </PopoverContent>
              </Popover>
            )}
          </div>
          <Select
            value={secondaryDimValue}
            onValueChange={updateSecondaryDim}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${fieldConfig.secondaryDimLabel.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {dimensionColumns.map((col) => (
                <SelectItem key={col.name} value={col.name}>
                  <span className="flex items-center gap-2">
                    {col.displayName || col.name}
                    <span className="text-xs text-muted-foreground">({col.role})</span>
                  </span>
                </SelectItem>
              ))}
              {columns
                .filter((c) => c.role !== 'dimension' && c.role !== 'time')
                .map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    <span className="flex items-center gap-2">
                      {col.displayName || col.name}
                      <span className="text-xs text-muted-foreground">({col.role})</span>
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm font-semibold">{fieldConfig.metricLabel}</Label>
          {MAPPING_FIELD_TOOLTIPS[chartType]?.[fieldConfig.metricLabel] && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="max-w-xs text-sm">
                {MAPPING_FIELD_TOOLTIPS[chartType][fieldConfig.metricLabel]}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {fieldConfig.multiMetric ? (
          <>
            {/* Multi-metric mode */}
            <div className="space-y-2">
              {actualMetrics.map((metricName) => {
                const col = columns.find((c) => c.name === metricName)
                const currentAgg = mapping.aggregations[metricName] ?? col?.aggregation ?? 'NONE'

                return (
                  <div key={metricName} className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1.5 py-1.5"
                    >
                      <span className="text-xs">{col?.displayName || metricName}</span>
                      <Select
                        value={currentAgg}
                        onValueChange={(v) => updateAggregation(metricName, v)}
                      >
                        <SelectTrigger className="h-5 w-auto gap-1 border-0 bg-transparent p-0 text-xs shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGGREGATION_OPTIONS.map((agg) => (
                            <SelectItem key={agg} value={agg}>
                              {agg}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() =>
                          hasSecondaryDim
                            ? handleRemoveMetricForSecondary(metricName)
                            : removeMetric(metricName)
                        }
                        className="ml-1 rounded-sm hover:bg-muted"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  </div>
                )
              })}
            </div>

            {availableMetrics.length > 0 && (
              <Select
                value=""
                onValueChange={(v) =>
                  hasSecondaryDim ? handleAddMetricForSecondary(v) : addMetric(v)
                }
              >
                <SelectTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Plus className="size-4" />
                    Add Metric
                  </Button>
                </SelectTrigger>
                <SelectContent>
                  {availableMetrics.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.displayName || col.name}
                    </SelectItem>
                  ))}
                  {availableAllMetrics.length > 0 && (
                    <>
                      {availableAllMetrics.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          <span className="flex items-center gap-2">
                            {col.displayName || col.name}
                            <span className="text-xs text-muted-foreground">({col.role})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}

            {fieldConfig.minMetrics && actualMetrics.length < fieldConfig.minMetrics && (
              <p className="text-xs text-muted-foreground">
                At least {fieldConfig.minMetrics} metrics required
              </p>
            )}
          </>
        ) : (
          <>
            {/* Single metric mode */}
            <Select
              value={actualMetrics[0] ?? ''}
              onValueChange={(v) => {
                const col = columns.find((c) => c.name === v)
                const defaultAgg = col?.aggregation ?? 'NONE'
                if (hasSecondaryDim) {
                  // Keep secondary dim at index 0, replace metric at index 1
                  const newMetrics = [mapping.metricColumns[0] ?? '', v]
                  onChange({
                    ...mapping,
                    metricColumns: newMetrics.filter(Boolean),
                    aggregations: {
                      ...mapping.aggregations,
                      [v]: defaultAgg,
                    },
                  })
                } else {
                  onChange({
                    ...mapping,
                    metricColumns: [v],
                    aggregations: { [v]: defaultAgg },
                  })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Select ${fieldConfig.metricLabel.toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {measureColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.displayName || col.name}
                  </SelectItem>
                ))}
                {columns
                  .filter((c) => c.role !== 'measure')
                  .map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      <span className="flex items-center gap-2">
                        {col.displayName || col.name}
                        <span className="text-xs text-muted-foreground">({col.role})</span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

          </>
        )}
      </div>
    </div>
  )
}
