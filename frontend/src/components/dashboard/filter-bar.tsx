import { useState } from 'react'

import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { CalendarIcon, Check, RotateCcw, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import { Separator } from '@/components/ui/separator'
import {
  MOCK_ENTITIES,
  MOCK_STATUSES,
  MOCK_DESKS,
} from '@/lib/mock/dashboard-config'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/stores/filter-store'
import type { DateRange } from '@/types/filter'

export function FilterBar() {
  const globalFilters = useFilterStore((s) => s.globalFilters)
  const setGlobalFilter = useFilterStore((s) => s.setGlobalFilter)
  const resetGlobalFilters = useFilterStore((s) => s.resetGlobalFilters)

  const [localDateRange, setLocalDateRange] = useState<DateRange>(
    globalFilters.dateRange,
  )
  const [localEntities, setLocalEntities] = useState<string[]>(
    globalFilters.entities,
  )
  const [localStatuses, setLocalStatuses] = useState<string[]>(
    globalFilters.statuses,
  )
  const [localDesk, setLocalDesk] = useState<string>(
    globalFilters.desks[0] ?? '',
  )

  const [dateOpen, setDateOpen] = useState(false)
  const [entityOpen, setEntityOpen] = useState(false)

  const hasActiveFilters =
    localEntities.length > 0 ||
    localStatuses.length > 0 ||
    (localDesk !== '' && localDesk !== 'All Desks')

  function handleApply() {
    setGlobalFilter('dateRange', localDateRange)
    setGlobalFilter('entities', localEntities)
    setGlobalFilter('statuses', localStatuses)
    setGlobalFilter('desks', localDesk && localDesk !== 'All Desks' ? [localDesk] : [])
  }

  function handleReset() {
    resetGlobalFilters()
    setLocalDateRange({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    })
    setLocalEntities([])
    setLocalStatuses([])
    setLocalDesk('')
  }

  function toggleEntity(entity: string) {
    setLocalEntities((prev) =>
      prev.includes(entity)
        ? prev.filter((e) => e !== entity)
        : [...prev, entity],
    )
  }

  function toggleStatus(status: string) {
    setLocalStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    )
  }

  function removeFilterChip(type: 'entity' | 'status' | 'desk', value: string) {
    if (type === 'entity') {
      setLocalEntities((prev) => prev.filter((e) => e !== value))
    } else if (type === 'status') {
      setLocalStatuses((prev) => prev.filter((s) => s !== value))
    } else {
      setLocalDesk('')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        {/* Date Range Picker */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 min-w-[220px] justify-start text-left font-normal',
                !localDateRange.from && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {localDateRange.from ? (
                <>
                  {format(localDateRange.from, 'MMM d, yyyy')}
                  {' - '}
                  {format(localDateRange.to, 'MMM d, yyyy')}
                </>
              ) : (
                'Select date range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{
                from: localDateRange.from,
                to: localDateRange.to,
              }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setLocalDateRange({ from: range.from, to: range.to })
                } else if (range?.from) {
                  setLocalDateRange({ from: range.from, to: range.from })
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Entity Selector (Searchable Multi-select via Command) */}
        <Popover open={entityOpen} onOpenChange={setEntityOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 min-w-[160px]">
              <Search className="mr-2 h-3.5 w-3.5" />
              {localEntities.length > 0
                ? `${localEntities.length} entit${localEntities.length === 1 ? 'y' : 'ies'}`
                : 'Entities'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search entities..." />
              <CommandList>
                <CommandEmpty>No entities found.</CommandEmpty>
                <CommandGroup>
                  {MOCK_ENTITIES.map((entity) => (
                    <CommandItem
                      key={entity}
                      value={entity}
                      onSelect={() => toggleEntity(entity)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          localEntities.includes(entity)
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible',
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      {entity}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Status Filter (Multi-select with checkboxes) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 min-w-[120px]">
              {localStatuses.length > 0
                ? `${localStatuses.length} status${localStatuses.length === 1 ? '' : 'es'}`
                : 'Status'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-3" align="start">
            <div className="space-y-2">
              {MOCK_STATUSES.map((status) => (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={localStatuses.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  {status}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Desk Filter (Single select) */}
        <Select value={localDesk} onValueChange={setLocalDesk}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Desk" />
          </SelectTrigger>
          <SelectContent>
            {MOCK_DESKS.map((desk) => (
              <SelectItem key={desk} value={desk}>
                {desk}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        {/* Apply / Reset */}
        <Button size="sm" className="h-9" onClick={handleApply}>
          Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={handleReset}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 border-t px-6 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Active:
          </span>
          {localEntities.map((entity) => (
            <Badge
              key={`entity-${entity}`}
              variant="secondary"
              className="gap-1 text-xs"
            >
              {entity}
              <button
                type="button"
                onClick={() => removeFilterChip('entity', entity)}
                className="ml-0.5 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {localStatuses.map((status) => (
            <Badge
              key={`status-${status}`}
              variant="secondary"
              className="gap-1 text-xs"
            >
              {status}
              <button
                type="button"
                onClick={() => removeFilterChip('status', status)}
                className="ml-0.5 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {localDesk && localDesk !== 'All Desks' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {localDesk}
              <button
                type="button"
                onClick={() => removeFilterChip('desk', localDesk)}
                className="ml-0.5 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </motion.div>
  )
}
