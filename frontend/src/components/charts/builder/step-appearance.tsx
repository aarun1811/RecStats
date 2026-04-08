import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ChartAppearance } from '@/types/managed-chart'

interface StepAppearanceProps {
  appearance: ChartAppearance
  onChange: (appearance: ChartAppearance) => void
}

export function StepAppearance({ appearance, onChange }: StepAppearanceProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="legend-toggle" className="text-sm">
          Legend
        </Label>
        <Switch
          id="legend-toggle"
          checked={appearance.showLegend}
          onCheckedChange={(checked) =>
            onChange({ ...appearance, showLegend: checked })
          }
        />
      </div>

      {appearance.showLegend && (
        <div className="flex items-center justify-between">
          <Label className="text-sm">Position</Label>
          <Select
            value={appearance.legendPosition}
            onValueChange={(v) =>
              onChange({
                ...appearance,
                legendPosition: v as ChartAppearance['legendPosition'],
              })
            }
          >
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="x-label-toggle" className="text-sm">
          X-Axis Label
        </Label>
        <Switch
          id="x-label-toggle"
          checked={appearance.showXLabel}
          onCheckedChange={(checked) =>
            onChange({ ...appearance, showXLabel: checked })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="y-label-toggle" className="text-sm">
          Y-Axis Label
        </Label>
        <Switch
          id="y-label-toggle"
          checked={appearance.showYLabel}
          onCheckedChange={(checked) =>
            onChange({ ...appearance, showYLabel: checked })
          }
        />
      </div>
    </div>
  )
}
