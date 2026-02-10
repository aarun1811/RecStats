import { useState, useMemo } from 'react'
import { AgCharts } from 'ag-charts-react'
import type { AgChartOptions } from 'ag-charts-community'
import { useTheme } from '@/components/layout/theme-provider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SqlResult } from '@/types/api'

interface ChartBuilderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SqlResult
}

type ChartType = 'bar' | 'line' | 'pie'

function pickDefaults(columns: string[], data: Record<string, unknown>[]) {
  // Pick first string-like column for X, first numeric column for Y
  let x = columns[0] ?? ''
  let y = columns[1] ?? ''
  if (data.length > 0) {
    const row = data[0]
    const numericCol = columns.find((c) => typeof row[c] === 'number')
    const stringCol = columns.find((c) => typeof row[c] === 'string')
    if (stringCol) x = stringCol
    if (numericCol) y = numericCol
  }
  return { x, y }
}

export function ChartBuilderDialog({ open, onOpenChange, result }: ChartBuilderDialogProps) {
  const { resolvedTheme } = useTheme()
  const defaults = pickDefaults(result.columns, result.data as Record<string, unknown>[])
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [xColumn, setXColumn] = useState(defaults.x)
  const [yColumn, setYColumn] = useState(defaults.y)

  const chartOptions = useMemo<AgChartOptions>(() => {
    const data = result.data as Record<string, unknown>[]
    const theme = resolvedTheme === 'dark' ? 'ag-default-dark' : 'ag-default'

    if (chartType === 'pie') {
      return {
        theme,
        data,
        series: [
          {
            type: 'pie',
            angleKey: yColumn,
            calloutLabelKey: xColumn,
          },
        ],
        background: { visible: false },
      }
    }

    return {
      theme,
      data,
      series: [
        {
          type: chartType,
          xKey: xColumn,
          yKey: yColumn,
          yName: yColumn,
        },
      ],
      axes: [
        { type: 'category', position: 'bottom' },
        { type: 'number', position: 'left' },
      ],
      background: { visible: false },
    }
  }, [chartType, xColumn, yColumn, result.data, resolvedTheme])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chart Builder</DialogTitle>
          <DialogDescription>Visualize your query results</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Chart Type</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{chartType === 'pie' ? 'Label' : 'X-Axis'}</Label>
            <Select value={xColumn} onValueChange={setXColumn}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {result.columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{chartType === 'pie' ? 'Value' : 'Y-Axis'}</Label>
            <Select value={yColumn} onValueChange={setYColumn}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {result.columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-[350px] mt-2 rounded-lg border bg-background">
          <AgCharts options={chartOptions} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
