import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import type { RecvizDataset } from '@/types/managed-dataset'

interface StepDatasetProps {
  datasetId: string | null
  onSelect: (dataset: RecvizDataset) => void
}

export function StepDataset({ datasetId, onSelect }: StepDatasetProps) {
  const [open, setOpen] = useState(false)
  const { data: datasets, isLoading } = useManagedDatasets()

  const selectedDataset = datasets?.find((d) => d.id === datasetId) ?? null

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        1. Dataset
      </h3>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedDataset ? selectedDataset.name : 'Select a dataset...'}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search datasets..." />
            <CommandList>
              <CommandEmpty>No datasets found.</CommandEmpty>
              <CommandGroup>
                {isLoading ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  datasets?.map((dataset) => (
                    <CommandItem
                      key={dataset.id}
                      value={dataset.name}
                      onSelect={() => {
                        onSelect(dataset)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4 shrink-0',
                          datasetId === dataset.id
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                      <span className="truncate">{dataset.name}</span>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
