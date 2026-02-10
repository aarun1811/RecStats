import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

function FilterBarSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-9 w-44" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-9 w-28" />
      <div className="ml-auto flex gap-2">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  )
}

function KpiCardSkeleton() {
  return (
    <Card className="p-6">
      <Skeleton className="mb-2 h-4 w-24" />
      <Skeleton className="mb-3 h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </Card>
  )
}

function ChartPanelSkeleton() {
  return (
    <Card className="flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-5" />
      </div>
      <Skeleton className="h-56 w-full rounded-md" />
    </Card>
  )
}

function GridSkeleton() {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <FilterBarSkeleton />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartPanelSkeleton key={i} />
        ))}
      </div>
      <GridSkeleton />
    </div>
  )
}

export function ExplorerSkeleton() {
  return (
    <div className="flex h-full gap-4">
      <Card className="w-64 shrink-0 p-4">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </Card>
      <div className="flex flex-1 flex-col gap-4">
        <Card className="flex-1 p-4">
          <Skeleton className="h-full w-full rounded-md" />
        </Card>
        <Card className="h-64 p-4">
          <Skeleton className="mb-3 h-5 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  )
}
