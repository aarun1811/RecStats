import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
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
import { resolveColor } from '@/lib/chart-themes'
import type { ChartAppearance, LibraryChartType } from '@/types/managed-chart'

// ---------------------------------------------------------------------------
// Color swatch picker -- constrained to palette presets
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  { name: 'Series 1', var: '--series-1' },
  { name: 'Series 2', var: '--series-2' },
  { name: 'Series 3', var: '--series-3' },
  { name: 'Series 4', var: '--series-4' },
  { name: 'Series 5', var: '--series-5' },
  { name: 'Series 6', var: '--series-6' },
  { name: 'Series 7', var: '--series-7' },
  { name: 'Series 8', var: '--series-8' },
  { name: 'Positive', var: '--chart-positive' },
  { name: 'Negative', var: '--chart-negative' },
] as const

interface ColorSwatchPickerProps {
  value: string
  onChange: (cssVar: string) => void
  label: string
}

function ColorSwatchPicker({ value, onChange, label }: ColorSwatchPickerProps) {
  const resolvedColor = value ? resolveColor(value) : '#888888'

  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="size-6 rounded-full border border-border shadow-sm transition-shadow hover:ring-2 hover:ring-ring/50"
            style={{ backgroundColor: resolvedColor }}
            title={value || 'Select color'}
          />
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-auto p-3">
          <p className="text-xs text-muted-foreground mb-2">{label}</p>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_COLORS.map((preset) => {
              const hex = resolveColor(preset.var)
              const isSelected = value === preset.var
              return (
                <button
                  key={preset.var}
                  type="button"
                  className="size-6 rounded-full border transition-shadow"
                  style={{
                    backgroundColor: hex,
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                    boxShadow: isSelected ? '0 0 0 2px var(--primary)' : 'none',
                  }}
                  title={preset.name}
                  onClick={() => onChange(preset.var)}
                />
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepAppearance
// ---------------------------------------------------------------------------

interface StepAppearanceProps {
  appearance: ChartAppearance
  onChange: (appearance: ChartAppearance) => void
  chartType?: LibraryChartType | null
}

export function StepAppearance({ appearance, onChange, chartType }: StepAppearanceProps) {
  // Helpers to read/write typeSpecific fields
  function getTypeField<T>(key: string, defaultValue: T): T {
    return (appearance.typeSpecific?.[key] as T) ?? defaultValue
  }

  function setTypeField(key: string, value: unknown) {
    onChange({
      ...appearance,
      typeSpecific: {
        ...appearance.typeSpecific,
        [key]: value,
      },
    })
  }

  function renderTypeSpecificFields() {
    if (!chartType) return null

    switch (chartType) {
      case 'heatmap':
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Color Range
            </p>
            <ColorSwatchPicker
              label="Min Color"
              value={getTypeField('colorRangeMin', '--series-1')}
              onChange={(v) => setTypeField('colorRangeMin', v)}
            />
            <ColorSwatchPicker
              label="Max Color"
              value={getTypeField('colorRangeMax', '--series-5')}
              onChange={(v) => setTypeField('colorRangeMax', v)}
            />
          </div>
        )

      case 'gauge':
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Gauge Range
            </p>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Min Value</Label>
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={getTypeField('gaugeMin', 0)}
                onChange={(e) => setTypeField('gaugeMin', Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Max Value</Label>
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={getTypeField('gaugeMax', 100)}
                onChange={(e) => setTypeField('gaugeMax', Number(e.target.value))}
              />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">
              Thresholds
            </p>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Danger Cutoff</Label>
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={getTypeField('gaugeDangerCutoff', 30)}
                onChange={(e) => setTypeField('gaugeDangerCutoff', Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Warning Cutoff</Label>
              <Input
                type="number"
                className="h-8 w-20 text-sm"
                value={getTypeField('gaugeWarningCutoff', 70)}
                onChange={(e) => setTypeField('gaugeWarningCutoff', Number(e.target.value))}
              />
            </div>
          </div>
        )

      case 'treemap':
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Color Range
            </p>
            <p className="text-xs text-muted-foreground">
              Color key is configured via the Column Mapping step.
            </p>
            <ColorSwatchPicker
              label="Min Color"
              value={getTypeField('colorRangeMin', '--series-1')}
              onChange={(v) => setTypeField('colorRangeMin', v)}
            />
            <ColorSwatchPicker
              label="Max Color"
              value={getTypeField('colorRangeMax', '--series-5')}
              onChange={(v) => setTypeField('colorRangeMax', v)}
            />
          </div>
        )

      case 'waterfall':
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Waterfall Colors
            </p>
            <ColorSwatchPicker
              label="Positive Color"
              value={getTypeField('waterfallPositive', '--chart-positive')}
              onChange={(v) => setTypeField('waterfallPositive', v)}
            />
            <ColorSwatchPicker
              label="Negative Color"
              value={getTypeField('waterfallNegative', '--chart-negative')}
              onChange={(v) => setTypeField('waterfallNegative', v)}
            />
          </div>
        )

      case 'pie':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Label Position</Label>
              <Select
                value={getTypeField('pieLabelPosition', 'outside')}
                onValueChange={(v) => setTypeField('pieLabelPosition', v)}
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outside">Outside</SelectItem>
                  <SelectItem value="inside">Inside</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 'donut':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Inner Radius</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {getTypeField('donutInnerRadius', 0.6)}
                </span>
              </div>
              <Slider
                min={30}
                max={80}
                step={5}
                value={[Math.round(getTypeField<number>('donutInnerRadius', 0.6) * 100)]}
                onValueChange={([v]) => setTypeField('donutInnerRadius', v / 100)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Label Position</Label>
              <Select
                value={getTypeField('donutLabelPosition', 'outside')}
                onValueChange={(v) => setTypeField('donutLabelPosition', v)}
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outside">Outside</SelectItem>
                  <SelectItem value="inside">Inside</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 'scatter':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Point Shape</Label>
              <Select
                value={getTypeField('scatterPointShape', 'circle')}
                onValueChange={(v) => setTypeField('scatterPointShape', v)}
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const typeFields = renderTypeSpecificFields()

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

      {/* Chart-type-specific options */}
      {typeFields && (
        <>
          <Separator />
          {typeFields}
        </>
      )}
    </div>
  )
}
