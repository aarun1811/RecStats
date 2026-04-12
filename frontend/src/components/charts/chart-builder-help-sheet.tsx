import { motion } from 'motion/react'
import { BookOpen, BarChart3, Columns3, Layers } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import type { LibraryChartType } from '@/types/managed-chart'

interface HelpSection {
  required: { field: string; description: string }[]
  optional: { field: string; description: string; defaultValue?: string }[]
  aggregation: string
  example: string
}

const CHART_HELP_CONTENT: Record<string, HelpSection> = {
  bar: {
    required: [
      { field: 'X-Axis', description: 'Category column. Each unique value becomes a bar group.' },
      { field: 'Metrics', description: 'One or more numeric columns. Each becomes a bar series.' },
    ],
    optional: [
      { field: 'Legend', description: 'Show/hide the legend.', defaultValue: 'Shown' },
      { field: 'Legend Position', description: 'Where to place the legend.', defaultValue: 'Bottom' },
    ],
    aggregation: 'Metrics are aggregated per category value using the selected function (SUM, AVG, etc.).',
    example: 'X-Axis: Region, Metrics: Revenue, Count',
  },
  'stacked-bar': {
    required: [
      { field: 'X-Axis', description: 'Category column. Each unique value becomes a bar group.' },
      { field: 'Metrics', description: 'Two or more numeric columns. Each becomes a stacked segment.' },
    ],
    optional: [
      { field: 'Legend', description: 'Show/hide the legend.', defaultValue: 'Shown' },
    ],
    aggregation: 'Metrics are stacked per category. Aggregation applies to each metric independently.',
    example: 'X-Axis: Quarter, Metrics: Product A Sales, Product B Sales',
  },
  line: {
    required: [
      { field: 'X-Axis', description: 'The horizontal axis. Typically a time or ordered category column.' },
      { field: 'Metrics', description: 'One or more numeric columns. Each becomes a separate line.' },
    ],
    optional: [
      { field: 'Legend', description: 'Show/hide the legend.', defaultValue: 'Shown' },
    ],
    aggregation: 'Metrics are aggregated per X-Axis value. Use SUM or AVG for meaningful trends.',
    example: 'X-Axis: Month, Metrics: Revenue, Expenses',
  },
  area: {
    required: [
      { field: 'X-Axis', description: 'The horizontal axis. Typically a time or ordered category.' },
      { field: 'Metrics', description: 'One or more numeric columns. Each becomes a filled area.' },
    ],
    optional: [
      { field: 'Legend', description: 'Show/hide the legend.', defaultValue: 'Shown' },
    ],
    aggregation: 'Metrics are aggregated per X-Axis value with filled area beneath each line.',
    example: 'X-Axis: Date, Metrics: Inflows, Outflows',
  },
  pie: {
    required: [
      { field: 'Category', description: 'Dimension column. Each unique value becomes a slice.' },
      { field: 'Metric', description: 'Single numeric column. Determines the size of each slice.' },
    ],
    optional: [
      { field: 'Label Position', description: 'Where to display slice labels.', defaultValue: 'Outside' },
    ],
    aggregation: 'The metric is aggregated per category value. Slices represent proportions of the total.',
    example: 'Category: Department, Metric: Budget',
  },
  donut: {
    required: [
      { field: 'Category', description: 'Dimension column. Each unique value becomes a segment.' },
      { field: 'Metric', description: 'Single numeric column. Determines segment size.' },
    ],
    optional: [
      { field: 'Inner Radius', description: 'Size of the center hole.', defaultValue: '0.6' },
      { field: 'Label Position', description: 'Where to display segment labels.', defaultValue: 'Outside' },
    ],
    aggregation: 'Same as pie chart. The metric is aggregated per category.',
    example: 'Category: Status, Metric: Count',
  },
  scatter: {
    required: [
      { field: 'X-Metric', description: 'Numeric column for horizontal position of each point.' },
      { field: 'Y-Metric', description: 'Numeric column for vertical position of each point.' },
    ],
    optional: [
      { field: 'Point Shape', description: 'Shape of scatter points.', defaultValue: 'Circle' },
    ],
    aggregation: 'No aggregation. Each row becomes a point plotted at (X, Y) coordinates.',
    example: 'X-Metric: Risk Score, Y-Metric: Exposure Amount',
  },
  heatmap: {
    required: [
      { field: 'X-Axis', description: 'Primary dimension. Columns of the heatmap grid.' },
      { field: 'Y-Axis', description: 'Secondary dimension. Rows of the heatmap grid.' },
      { field: 'Color Metric', description: 'Numeric column whose values determine cell color intensity.' },
    ],
    optional: [
      { field: 'Color Range', description: 'Min and max colors for the gradient.', defaultValue: 'Palette defaults' },
    ],
    aggregation: 'The color metric is aggregated per (X, Y) combination to produce each cell value.',
    example: 'X-Axis: Month, Y-Axis: Region, Color Metric: Breaks Count',
  },
  treemap: {
    required: [
      { field: 'Category', description: 'Dimension column used as rectangle labels.' },
      { field: 'Metric', description: 'Numeric column determining rectangle size.' },
    ],
    optional: [
      { field: 'Color Range', description: 'Min and max colors for size-based coloring.', defaultValue: 'Palette defaults' },
    ],
    aggregation: 'The metric is aggregated per category. Larger values produce larger rectangles.',
    example: 'Category: Asset Class, Metric: Market Value',
  },
  waterfall: {
    required: [
      { field: 'Category', description: 'Step labels along the x-axis (e.g., line items).' },
      { field: 'Metric', description: 'Numeric column. Positive values go up, negative go down.' },
    ],
    optional: [
      { field: 'Positive Color', description: 'Color for increasing values.', defaultValue: 'Green' },
      { field: 'Negative Color', description: 'Color for decreasing values.', defaultValue: 'Red' },
    ],
    aggregation: 'Each row is a step. The chart shows cumulative effect of sequential values.',
    example: 'Category: Item, Metric: Amount',
  },
  bullet: {
    required: [
      { field: 'Category', description: 'Label for each bullet row.' },
      { field: 'Metric', description: 'Actual performance value to display.' },
    ],
    optional: [
      { field: 'Target', description: 'Target/goal value for comparison.', defaultValue: 'Not set' },
    ],
    aggregation: 'The metric is shown as a bar against an optional target marker.',
    example: 'Category: KPI Name, Metric: Actual Value',
  },
  'box-plot': {
    required: [
      { field: 'Category', description: 'Grouping dimension for each box.' },
      { field: 'Value', description: 'Numeric column. Distribution computed per category.' },
    ],
    optional: [],
    aggregation: 'Min, Q1, median, Q3, and max are computed from the value column per category.',
    example: 'Category: Department, Value: Processing Time',
  },
  combo: {
    required: [
      { field: 'X-Axis', description: 'Shared category axis for both series types.' },
      { field: 'Metrics', description: 'Two or more metrics. First renders as bars, second as line.' },
    ],
    optional: [
      { field: 'Legend', description: 'Show/hide the legend.', defaultValue: 'Shown' },
    ],
    aggregation: 'Each metric is aggregated independently. Bar and line share the same X-Axis.',
    example: 'X-Axis: Month, Metrics: Revenue (bar), Growth Rate (line)',
  },
  sankey: {
    required: [
      { field: 'Source', description: 'Start node for each flow connection.' },
      { field: 'Target', description: 'End node for each flow connection.' },
      { field: 'Value', description: 'Numeric weight of each connection.' },
    ],
    optional: [],
    aggregation: 'Each row represents one link. Values determine link thickness.',
    example: 'Source: From Account, Target: To Account, Value: Transfer Amount',
  },
  sunburst: {
    required: [
      { field: 'Levels', description: 'Hierarchical category column (or pre-shaped data).' },
      { field: 'Value', description: 'Numeric column determining arc size.' },
    ],
    optional: [],
    aggregation: 'Data should be pre-shaped into a hierarchy. Each level becomes a ring.',
    example: 'Levels: Region > Country > City, Value: Population',
  },
  radar: {
    required: [
      { field: 'Category', description: 'Indicator labels around the radar perimeter.' },
      { field: 'Metrics', description: 'Two or more numeric columns. Each becomes a radar axis.' },
    ],
    optional: [],
    aggregation: 'Metrics are plotted as polygons on the radar grid. Max auto-calculated at 1.2x data max.',
    example: 'Category: Skill, Metrics: Team A Score, Team B Score',
  },
  gauge: {
    required: [
      { field: 'Metric', description: 'Single numeric value to display on the gauge dial.' },
    ],
    optional: [
      { field: 'Min Value', description: 'Lower bound of the gauge range.', defaultValue: '0' },
      { field: 'Max Value', description: 'Upper bound of the gauge range.', defaultValue: '100' },
      { field: 'Danger Cutoff', description: 'Threshold below which the value is danger (red).', defaultValue: '30' },
      { field: 'Warning Cutoff', description: 'Threshold below which the value is warning (amber).', defaultValue: '70' },
    ],
    aggregation: 'Displays a single aggregated value. If multiple rows, the first value is used.',
    example: 'Metric: Completion Rate',
  },
  funnel: {
    required: [
      { field: 'Category', description: 'Stage labels in the funnel.' },
      { field: 'Metric', description: 'Numeric column determining each stage width.' },
    ],
    optional: [],
    aggregation: 'Each row is a funnel stage. Stages are displayed in descending order by default.',
    example: 'Category: Pipeline Stage, Metric: Deal Count',
  },
  graph: {
    required: [
      { field: 'Source', description: 'Source node for each edge.' },
      { field: 'Target', description: 'Target node for each edge.' },
      { field: 'Weight', description: 'Numeric weight of each edge connection.' },
    ],
    optional: [],
    aggregation: 'Each row represents an edge. Nodes are auto-derived from source/target values.',
    example: 'Source: Entity A, Target: Entity B, Weight: Interaction Count',
  },
  parallel: {
    required: [
      { field: 'Category', description: 'Grouping dimension for color-coding lines.' },
      { field: 'Metrics', description: 'Two or more numeric columns. Each becomes a parallel axis.' },
    ],
    optional: [],
    aggregation: 'Each row becomes a polyline across all axes. No aggregation applied.',
    example: 'Category: Product, Metrics: Price, Rating, Sales Volume',
  },
}

// ---------------------------------------------------------------------------

interface ChartBuilderHelpSheetProps {
  chartType: LibraryChartType | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChartBuilderHelpSheet({ chartType, open, onOpenChange }: ChartBuilderHelpSheetProps) {
  const content = chartType ? CHART_HELP_CONTENT[chartType] : null
  const displayName = chartType ? CHART_DISPLAY_NAMES[chartType] ?? chartType : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {chartType && <ChartTypeIcon chartType={chartType} size={18} />}
            {displayName} Reference
          </SheetTitle>
          <SheetDescription>
            Configuration guide for mapping and appearance options.
          </SheetDescription>
        </SheetHeader>

        {!content && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Select a chart type to see its configuration reference.
          </div>
        )}

        {content && (
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="px-4 pb-6 space-y-5"
          >
            {/* Required Fields */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Columns3 className="size-4 text-primary/60" />
                <h3 className="text-sm font-semibold">Required Fields</h3>
              </div>
              <div className="space-y-1.5">
                {content.required.map((field) => (
                  <div key={field.field} className="pl-6">
                    <span className="text-sm font-medium">{field.field}</span>
                    <p className="text-sm text-muted-foreground">{field.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Optional Fields */}
            {content.optional.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary/60" />
                  <h3 className="text-sm font-semibold">Optional Fields</h3>
                </div>
                <div className="space-y-1.5">
                  {content.optional.map((field) => (
                    <div key={field.field} className="pl-6">
                      <span className="text-sm font-medium">{field.field}</span>
                      {field.defaultValue && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          (default: {field.defaultValue})
                        </span>
                      )}
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Aggregation */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-primary/60" />
                <h3 className="text-sm font-semibold">Aggregation</h3>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {content.aggregation}
              </p>
            </section>

            {/* Example Mapping */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary/60" />
                <h3 className="text-sm font-semibold">Example Mapping</h3>
              </div>
              <p className="text-sm text-muted-foreground pl-6 font-mono">
                {content.example}
              </p>
            </section>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  )
}
