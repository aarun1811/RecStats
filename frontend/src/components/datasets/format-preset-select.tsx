import { useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { FormatPreset } from '@/types/managed-dataset'

interface FormatPresetOption {
  id: FormatPreset
  label: string
  formatString: string
  example: string
}

export const FORMAT_PRESETS: FormatPresetOption[] = [
  { id: 'none', label: 'None', formatString: '', example: '--' },
  { id: 'number', label: 'Number', formatString: '#,###', example: '1,234' },
  { id: 'currency', label: 'Currency', formatString: '$#,###.##', example: '$1,234.56' },
  { id: 'percentage', label: 'Percentage', formatString: '##.#%', example: '85.3%' },
  { id: 'decimal2', label: 'Decimal (2)', formatString: '#,###.##', example: '1,234.56' },
  { id: 'date', label: 'Date', formatString: 'MMM dd', example: 'Apr 06' },
  { id: 'datetime', label: 'DateTime', formatString: 'MMM dd HH:mm', example: 'Apr 06 14:30' },
  { id: 'custom', label: 'Custom...', formatString: '', example: '' },
]

interface FormatPresetSelectProps {
  value: FormatPreset
  formatString: string
  onChange: (preset: FormatPreset, formatString: string) => void
}

export function FormatPresetSelect({ value, formatString, onChange }: FormatPresetSelectProps) {
  const [showCustomInput, setShowCustomInput] = useState(value === 'custom')

  const handlePresetChange = (presetId: string) => {
    const preset = FORMAT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return

    if (preset.id === 'custom') {
      setShowCustomInput(true)
      onChange('custom', formatString)
    } else {
      setShowCustomInput(false)
      onChange(preset.id, preset.formatString)
    }
  }

  const handleCustomFormatChange = (newFormatString: string) => {
    onChange('custom', newFormatString)
  }

  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={handlePresetChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select format" />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              <span className="flex items-center justify-between gap-4 w-full">
                <span>{preset.label}</span>
                {preset.example && (
                  <span className="text-muted-foreground text-xs">{preset.example}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showCustomInput && (
        <Input
          className="h-7 text-xs font-mono"
          placeholder="Intl.NumberFormat or date-fns pattern"
          value={formatString}
          onChange={(e) => handleCustomFormatChange(e.target.value)}
        />
      )}
    </div>
  )
}
