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
import { getTrendSubtitle } from '@/lib/kpi-utils'
import type { TrendConfig, TrendPeriodConfig, TrendTargetConfig } from '@/types/managed-kpi'

interface StepTrendProps {
  trend: TrendConfig | null
  subtitle: string
  onTrendChange: (trend: TrendConfig | null) => void
  onSubtitleChange: (subtitle: string) => void
}

const DEFAULT_PERIOD_TREND: TrendPeriodConfig = {
  mode: 'previous_period',
  period: 'week',
}

const DEFAULT_TARGET_TREND: TrendTargetConfig = {
  mode: 'static_target',
  targetValue: 0,
  targetLabel: '',
}

export function StepTrend({
  trend,
  subtitle,
  onTrendChange,
  onSubtitleChange,
}: StepTrendProps) {
  const enabled = trend !== null
  const mode = trend?.mode ?? 'previous_period'

  function handleToggle(checked: boolean) {
    if (checked) {
      const newTrend = DEFAULT_PERIOD_TREND
      onTrendChange(newTrend)
      onSubtitleChange(getTrendSubtitle(newTrend))
    } else {
      onTrendChange(null)
      onSubtitleChange('')
    }
  }

  function handleModeChange(newMode: string) {
    if (newMode === 'previous_period') {
      const newTrend = DEFAULT_PERIOD_TREND
      onTrendChange(newTrend)
      onSubtitleChange(getTrendSubtitle(newTrend))
    } else {
      const newTrend = DEFAULT_TARGET_TREND
      onTrendChange(newTrend)
      onSubtitleChange(getTrendSubtitle(newTrend))
    }
  }

  function handlePeriodChange(period: 'day' | 'week' | 'month') {
    const newTrend: TrendPeriodConfig = { mode: 'previous_period', period }
    onTrendChange(newTrend)
    onSubtitleChange(getTrendSubtitle(newTrend))
  }

  function handleTargetValueChange(value: number) {
    if (trend?.mode !== 'static_target') return
    const newTrend: TrendTargetConfig = {
      ...trend,
      targetValue: value,
    }
    onTrendChange(newTrend)
    onSubtitleChange(getTrendSubtitle(newTrend))
  }

  function handleTargetLabelChange(label: string) {
    if (trend?.mode !== 'static_target') return
    const newTrend: TrendTargetConfig = {
      ...trend,
      targetLabel: label,
    }
    onTrendChange(newTrend)
    onSubtitleChange(getTrendSubtitle(newTrend))
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        4. Trend Comparison
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="trend-toggle" className="text-sm">
            Enable Trend
          </Label>
          <Switch
            id="trend-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Mode</Label>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous_period">
                    Compare to previous period
                  </SelectItem>
                  <SelectItem value="static_target">
                    Compare to target value
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {trend?.mode === 'previous_period' && (
              <div className="space-y-2">
                <Label className="text-sm">Period</Label>
                <Select
                  value={trend.period}
                  onValueChange={(v) =>
                    handlePeriodChange(v as 'day' | 'week' | 'month')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {trend?.mode === 'static_target' && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Target Value</Label>
                  <Input
                    type="number"
                    value={trend.targetValue}
                    onChange={(e) =>
                      handleTargetValueChange(Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Target Label</Label>
                  <Input
                    placeholder="SLA target"
                    value={trend.targetLabel}
                    onChange={(e) => handleTargetLabelChange(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Subtitle</Label>
              <Input
                placeholder="e.g. vs last week"
                value={subtitle}
                onChange={(e) => onSubtitleChange(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
