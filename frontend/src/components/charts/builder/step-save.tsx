import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface StepSaveProps {
  name: string
  description: string
  onChange: (name: string, description: string) => void
  onSave: () => void
  isSaving: boolean
  mode: 'create' | 'edit'
  isChartComplete: boolean
}

export function StepSave({
  name,
  description,
  onChange,
  onSave,
  isSaving,
  mode,
  isChartComplete,
}: StepSaveProps) {
  const saveDisabled = !isChartComplete || isSaving

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="chart-name" className="text-sm font-semibold">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="chart-name"
          value={name}
          onChange={(e) => onChange(e.target.value, description)}
          placeholder="Chart name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="chart-description" className="text-sm font-semibold">
          Description
        </Label>
        <Textarea
          id="chart-description"
          value={description}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder="Add a description (optional)"
          rows={3}
        />
      </div>

      <Button
        onClick={onSave}
        disabled={saveDisabled}
        className="w-full"
      >
        {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
        Save Chart
      </Button>

      {!isChartComplete && name.trim() !== '' && (
        <p className="text-xs text-muted-foreground">
          Complete all steps before saving
        </p>
      )}
    </div>
  )
}
