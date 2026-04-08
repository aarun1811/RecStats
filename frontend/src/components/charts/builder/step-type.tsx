import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChartTypeIcon, CHART_DISPLAY_NAMES } from '@/components/charts/chart-type-icon'
import { isChartTypeCompatible } from '@/lib/chart-compatibility'
import type { DatasetShape } from '@/lib/chart-compatibility'
import type { LibraryChartType } from '@/types/managed-chart'

const STANDARD_TYPES: LibraryChartType[] = [
  'bar', 'stacked-bar', 'line', 'area',
  'pie', 'donut', 'scatter', 'heatmap',
  'treemap', 'waterfall', 'combo',
]

const EXOTIC_TYPES: LibraryChartType[] = [
  'sankey', 'sunburst', 'radar', 'graph',
  'gauge', 'parallel', 'funnel',
]

interface StepTypeProps {
  datasetShape: DatasetShape
  selectedType: LibraryChartType | null
  onSelect: (type: LibraryChartType) => void
}

export function StepType({ datasetShape, selectedType, onSelect }: StepTypeProps) {
  return (
    <div className="space-y-4">
      <ChartTypeGroup
        label="Standard"
        types={STANDARD_TYPES}
        datasetShape={datasetShape}
        selectedType={selectedType}
        onSelect={onSelect}
      />
      <ChartTypeGroup
        label="Exotic"
        types={EXOTIC_TYPES}
        datasetShape={datasetShape}
        selectedType={selectedType}
        onSelect={onSelect}
      />
    </div>
  )
}

interface ChartTypeGroupProps {
  label: string
  types: LibraryChartType[]
  datasetShape: DatasetShape
  selectedType: LibraryChartType | null
  onSelect: (type: LibraryChartType) => void
}

function ChartTypeGroup({ label, types, datasetShape, selectedType, onSelect }: ChartTypeGroupProps) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h4>
      <div className="grid grid-cols-4 gap-2">
        {types.map((type) => {
          const { compatible, tooltip } = isChartTypeCompatible(type, datasetShape)
          const isSelected = selectedType === type

          const cellClass = 'flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-md p-2'

          if (!compatible) {
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <div className={cn(cellClass, 'cursor-not-allowed opacity-40')}>
                    <ChartTypeIcon chartType={type} size={24} />
                    <span className="text-[10px] leading-tight text-center">{CHART_DISPLAY_NAMES[type]}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={cn(
                cellClass,
                'transition-colors',
                isSelected
                  ? 'bg-primary/5 ring-2 ring-primary'
                  : 'cursor-pointer hover:bg-muted/50',
              )}
            >
              <ChartTypeIcon chartType={type} size={24} />
              <span className="text-[10px] leading-tight text-center">{CHART_DISPLAY_NAMES[type]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
