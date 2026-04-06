import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { ThresholdConfig } from '@/types/managed-kpi'

interface StepThresholdsProps {
  thresholds: ThresholdConfig | null
  name: string
  description: string
  onThresholdsChange: (t: ThresholdConfig | null) => void
  onNameChange: (name: string) => void
  onDescriptionChange: (desc: string) => void
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  greenAbove: 95,
  amberAbove: 80,
}

export function StepThresholds({
  thresholds,
  name,
  description,
  onThresholdsChange,
  onNameChange,
  onDescriptionChange,
}: StepThresholdsProps) {
  const enabled = thresholds !== null

  function handleToggle(checked: boolean) {
    if (checked) {
      onThresholdsChange(DEFAULT_THRESHOLDS)
    } else {
      onThresholdsChange(null)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        5. Thresholds & Details
      </h3>
      <div className="space-y-4">
        {/* Thresholds toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="threshold-toggle" className="text-sm">
            Enable Thresholds
          </Label>
          <Switch
            id="threshold-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {enabled && thresholds && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Green above</Label>
              <div className="flex items-center gap-2">
                <div className="w-1 h-8 rounded-full bg-green-600 shrink-0" />
                <Input
                  type="number"
                  value={thresholds.greenAbove}
                  onChange={(e) =>
                    onThresholdsChange({
                      ...thresholds,
                      greenAbove: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Amber above</Label>
              <div className="flex items-center gap-2">
                <div className="w-1 h-8 rounded-full bg-amber-600 shrink-0" />
                <Input
                  type="number"
                  value={thresholds.amberAbove}
                  onChange={(e) =>
                    onThresholdsChange({
                      ...thresholds,
                      amberAbove: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            {/* Visual legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-green-600 dark:bg-green-400" />
                <span>Green &ge; {thresholds.greenAbove}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                <span>Amber &ge; {thresholds.amberAbove}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-red-600 dark:bg-red-400" />
                <span>Red &lt; {thresholds.amberAbove}</span>
              </div>
            </div>
          </>
        )}

        {/* Name */}
        <div className="space-y-2">
          <Label className="text-sm">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="KPI name"
            maxLength={256}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm">Description</Label>
          <Textarea
            placeholder="Optional description..."
            maxLength={1024}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
