import { useMemo, useState } from 'react'
import { ChevronsUpDown, Lock, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useFilterOptions } from '@/hooks/use-filter-options'
import { useFilterStore } from '@/stores/filter-store'
import { cn } from '@/lib/utils'
import type { FilterConfig } from '@/types/dashboard-config'
import type { FilterValue } from '@/types/filter'

interface ConfigFilterBarProps {
  filters: FilterConfig[]
}

export function ConfigFilterBar({ filters }: ConfigFilterBarProps) {
  const values = useFilterStore((s) => s.values)
  const locked = useFilterStore((s) => s.locked)
  const setFilterValue = useFilterStore((s) => s.setFilterValue)
  const applyFilters = useFilterStore((s) => s.applyFilters)
  const resetFilters = useFilterStore((s) => s.resetFilters)

  const defaults = useMemo(() => {
    const d: Record<string, FilterValue> = {}
    for (const f of filters) {
      if (f.defaultValue !== undefined) {
        d[f.id] = f.defaultValue
      }
    }
    return d
  }, [filters])

  const handleReset = () => {
    resetFilters(defaults)
  }

  return (
    <Card className="bg-muted/50 p-4">
      <div className="flex flex-wrap items-end gap-4">
        {filters.map((filter) => (
          <FilterControl
            key={filter.id}
            config={filter}
            value={values[filter.id]}
            allValues={values}
            isLocked={locked.has(filter.id)}
            onChange={(val) => setFilterValue(filter.id, val)}
          />
        ))}

        {/* Actions */}
        <div className="ml-auto flex items-end gap-2">
          <Button onClick={applyFilters}>Apply</Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Individual filter control dispatcher
// ---------------------------------------------------------------------------

interface FilterControlProps {
  config: FilterConfig
  value: FilterValue | undefined
  allValues: Record<string, FilterValue>
  isLocked: boolean
  onChange: (value: FilterValue) => void
}

function FilterControl({ config, value, allValues, isLocked, onChange }: FilterControlProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
        {config.label}
        {isLocked && <Lock className="size-3" />}
      </span>

      {config.type === 'single-select' && (
        <SingleSelectFilter
          config={config}
          value={value as string | undefined}
          allValues={allValues}
          disabled={isLocked}
          onChange={onChange}
        />
      )}

      {config.type === 'multi-select' && (
        <MultiSelectFilter
          config={config}
          value={value as string[] | undefined}
          allValues={allValues}
          disabled={isLocked}
          onChange={onChange}
        />
      )}

      {config.type === 'preset-range' && (
        <PresetRangeFilter
          config={config}
          value={value as string | number | undefined}
          disabled={isLocked}
          onChange={onChange}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single-select filter (Shadcn Select)
// ---------------------------------------------------------------------------

interface SingleSelectFilterProps {
  config: FilterConfig
  value: string | undefined
  allValues: Record<string, FilterValue>
  disabled: boolean
  onChange: (value: FilterValue) => void
}

function SingleSelectFilter({ config, value, allValues, disabled, onChange }: SingleSelectFilterProps) {
  const hasOptionsSource = !!config.optionsSource
  const { data, isLoading } = useFilterOptions(
    config.optionsSource?.dataSourceId ?? '',
    config.optionsSource?.valueColumn ?? '',
    config.optionsSource?.dependsOn ?? {},
    allValues,
    hasOptionsSource,
  )

  const options = hasOptionsSource ? (data?.values ?? []) : (config.options?.map((o) => String(o.value)) ?? [])

  return (
    <Select
      value={value ?? ''}
      onValueChange={(val) => onChange(val)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={isLoading ? 'Loading...' : `All ${config.label.toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
// Multi-select filter (Popover + Command combobox with checkboxes)
// ---------------------------------------------------------------------------

interface MultiSelectFilterProps {
  config: FilterConfig
  value: string[] | undefined
  allValues: Record<string, FilterValue>
  disabled: boolean
  onChange: (value: FilterValue) => void
}

function MultiSelectFilter({ config, value, allValues, disabled, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const selected = value ?? []

  const hasOptionsSource = !!config.optionsSource
  const { data, isLoading } = useFilterOptions(
    config.optionsSource?.dataSourceId ?? '',
    config.optionsSource?.valueColumn ?? '',
    config.optionsSource?.dependsOn ?? {},
    allValues,
    hasOptionsSource,
  )

  const options = hasOptionsSource ? (data?.values ?? []) : (config.options?.map((o) => String(o.value)) ?? [])

  const toggle = (item: string) => {
    const current = [...selected]
    const idx = current.indexOf(item)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(item)
    }
    onChange(current)
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-[200px] justify-between font-normal"
        >
          {selected.length > 0 ? (
            <span className="flex items-center gap-1.5">
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                {selected.length}
              </Badge>
              <span className="truncate">selected</span>
            </span>
          ) : isLoading ? (
            'Loading...'
          ) : (
            `All ${config.label.toLowerCase()}`
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder={`Search ${config.label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => toggle(opt)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Checkbox
                    checked={selected.includes(opt)}
                    className="mr-2"
                    tabIndex={-1}
                    onCheckedChange={() => toggle(opt)}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Preset-range filter (ToggleGroup)
// ---------------------------------------------------------------------------

interface PresetRangeFilterProps {
  config: FilterConfig
  value: string | number | undefined
  disabled: boolean
  onChange: (value: FilterValue) => void
}

function PresetRangeFilter({ config, value, disabled, onChange }: PresetRangeFilterProps) {
  const presets = config.options ?? []

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value !== undefined ? String(value) : ''}
      onValueChange={(val) => {
        if (val) {
          // Attempt to preserve numeric type if the original option value was numeric
          const matchedOption = presets.find((o) => String(o.value) === val)
          onChange(matchedOption ? matchedOption.value : val)
        }
      }}
      disabled={disabled}
      className={cn(disabled && 'opacity-50')}
    >
      {presets.map((preset) => (
        <ToggleGroupItem
          key={String(preset.value)}
          value={String(preset.value)}
          size="sm"
        >
          {preset.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
