import { useState } from 'react'
import { Check, ChevronsUpDown, Database } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  selectedDataset: RecvizDataset | null
  onSelect: (dataset: RecvizDataset) => void
}

export function StepDataset({ selectedDataset, onSelect }: StepDatasetProps) {
  const [open, setOpen] = useState(false)
  const { data: datasets, isLoading } = useManagedDatasets()

  return (
    <div className="space-y-4">
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
                          'mr-2 size-4',
                          selectedDataset?.id === dataset.id
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                      <span className="flex-1 truncate">{dataset.name}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                        <Database className="mr-1 size-3" />
                        {dataset.databaseId}
                      </Badge>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedDataset && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{selectedDataset.name}</span>
            <Badge variant="outline" className="text-xs">
              <Database className="mr-1 size-3" />
              {selectedDataset.databaseId}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedDataset.columns.length} columns
          </p>
        </div>
      )}
    </div>
  )
}
