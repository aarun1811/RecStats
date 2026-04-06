import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { KpiFormatConfig } from '@/types/managed-kpi'
import type { FormatType } from '@/types/formatting'

const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'decimal', label: 'Decimal' },
]

interface StepFormatProps {
  format: KpiFormatConfig
  onChange: (format: KpiFormatConfig) => void
}

export function StepFormat({ format, onChange }: StepFormatProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        3. Format
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Format Type</Label>
          <Select
            value={format.type}
            onValueChange={(v) =>
              onChange({ ...format, type: v as FormatType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {format.type === 'currency' && (
          <div className="space-y-2">
            <Label className="text-sm">Currency Code</Label>
            <Input
              placeholder="USD"
              maxLength={3}
              value={format.currencyCode ?? ''}
              onChange={(e) =>
                onChange({
                  ...format,
                  currencyCode: e.target.value || null,
                })
              }
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="abbreviate-toggle" className="text-sm">
            Abbreviate (e.g. 1.2M)
          </Label>
          <Switch
            id="abbreviate-toggle"
            checked={format.abbreviate}
            onCheckedChange={(checked) =>
              onChange({ ...format, abbreviate: checked })
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Decimal Places</Label>
          <Input
            type="number"
            min={0}
            max={6}
            placeholder="Auto"
            value={format.decimals ?? ''}
            onChange={(e) =>
              onChange({
                ...format,
                decimals: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
