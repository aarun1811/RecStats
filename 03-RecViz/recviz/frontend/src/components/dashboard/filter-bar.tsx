import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useFilterStore } from '@/stores/filter-store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['Open', 'Resolved', 'Investigating', 'Escalated']
const DESK_OPTIONS = ['Operations', 'Treasury', 'Settlements', 'FX', 'Equity']

export function FilterBar() {
  const {
    globalFilters,
    updateGlobalFilter,
    applyFilters,
    resetGlobalFilters,
  } = useFilterStore()

  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    globalFilters.dateFrom ? new Date(globalFilters.dateFrom) : undefined,
  )
  const [dateTo, setDateTo] = useState<Date | undefined>(
    globalFilters.dateTo ? new Date(globalFilters.dateTo) : undefined,
  )
  const [entityOpen, setEntityOpen] = useState(false)

  const selectedStatuses = globalFilters.status ?? []
  const selectedDesks = globalFilters.desk ?? []
  const selectedCounterparties = globalFilters.counterparty ?? []

  const { data: counterparties = [] } = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => api.get<string[]>('/api/custom/counterparties'),
  })

  const toggleStatus = (status: string) => {
    const current = [...selectedStatuses]
    const idx = current.indexOf(status)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(status)
    }
    updateGlobalFilter('status', current)
  }

  const toggleCounterparty = (name: string) => {
    const current = [...selectedCounterparties]
    const idx = current.indexOf(name)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(name)
    }
    updateGlobalFilter('counterparty', current)
  }

  const handleApply = () => {
    if (dateFrom) {
      updateGlobalFilter('dateFrom', format(dateFrom, 'yyyy-MM-dd'))
    }
    if (dateTo) {
      updateGlobalFilter('dateTo', format(dateTo, 'yyyy-MM-dd'))
    }
    applyFilters()
  }

  const handleReset = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    resetGlobalFilters()
  }

  const activeChips: { label: string; onRemove: () => void }[] = []

  if (dateFrom) {
    activeChips.push({
      label: `From: ${format(dateFrom, 'MMM d, yyyy')}`,
      onRemove: () => {
        setDateFrom(undefined)
        updateGlobalFilter('dateFrom', undefined)
      },
    })
  }
  if (dateTo) {
    activeChips.push({
      label: `To: ${format(dateTo, 'MMM d, yyyy')}`,
      onRemove: () => {
        setDateTo(undefined)
        updateGlobalFilter('dateTo', undefined)
      },
    })
  }
  for (const s of selectedStatuses) {
    activeChips.push({
      label: `Status: ${s}`,
      onRemove: () => toggleStatus(s),
    })
  }
  for (const d of selectedDesks) {
    activeChips.push({
      label: `Desk: ${d}`,
      onRemove: () => {
        updateGlobalFilter(
          'desk',
          selectedDesks.filter((x) => x !== d),
        )
      },
    })
  }
  for (const c of selectedCounterparties) {
    activeChips.push({
      label: `Entity: ${c}`,
      onRemove: () => toggleCounterparty(c),
    })
  }

  return (
    <Card className="bg-muted/50 p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Date From */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[160px] justify-start text-left font-normal',
                  !dateFrom && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[160px] justify-start text-left font-normal',
                  !dateTo && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 size-4" />
                {dateTo ? format(dateTo, 'MMM d, yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Entity / Counterparty combobox (multi-select) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Entity</Label>
          <Popover open={entityOpen} onOpenChange={setEntityOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={entityOpen}
                className="w-[200px] justify-between font-normal"
              >
                {selectedCounterparties.length > 0
                  ? `${selectedCounterparties.length} selected`
                  : 'All entities'}
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[200px] p-0"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Command>
                <CommandInput placeholder="Search entity..." />
                <CommandList>
                  <CommandEmpty>No entity found.</CommandEmpty>
                  <CommandGroup>
                    {counterparties.map((name) => (
                      <CommandItem
                        key={name}
                        value={name}
                        onSelect={() => toggleCounterparty(name)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            selectedCounterparties.includes(name)
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        {name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Status multi-select */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start">
                <SlidersHorizontal className="mr-2 size-4" />
                {selectedStatuses.length > 0
                  ? `${selectedStatuses.length} selected`
                  : 'All statuses'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-3" align="start">
              <div className="flex flex-col gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={() => toggleStatus(status)}
                    />
                    <span className="text-sm">{status}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Desk selector */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Desk</Label>
          <Select
            value={selectedDesks[0] ?? ''}
            onValueChange={(val) =>
              updateGlobalFilter('desk', val ? [val] : [])
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All desks" />
            </SelectTrigger>
            <SelectContent>
              {DESK_OPTIONS.map((desk) => (
                <SelectItem key={desk} value={desk}>
                  {desk}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleApply}>Apply</Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <Badge
              key={chip.label}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </Card>
  )
}
