import { Filter, Gauge, PieChart, Table2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AddContentMenuProps {
  onSelectChart: () => void
  onSelectKpi: () => void
  onSelectGrid: () => void
  onSelectFilter: () => void
  children: React.ReactNode
}

export function AddContentMenu({
  onSelectChart,
  onSelectKpi,
  onSelectGrid,
  onSelectFilter,
  children,
}: AddContentMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onSelectChart}>
          <PieChart className="mr-2 size-4" />
          <span className="text-sm">Chart</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSelectKpi}>
          <Gauge className="mr-2 size-4" />
          <span className="text-sm">KPI</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSelectGrid}>
          <Table2 className="mr-2 size-4" />
          <span className="text-sm">Data Grid</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSelectFilter}>
          <Filter className="mr-2 size-4" />
          <span className="text-sm">Filter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
