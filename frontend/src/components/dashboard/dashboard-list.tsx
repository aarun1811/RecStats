import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { LayoutDashboard, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useManagedDashboards } from '@/hooks/use-managed-dashboards'
import { DeleteDashboardDialog } from '@/components/builder/delete-dashboard-dialog'
import { DashboardListToolbar } from './dashboard-list-toolbar'
import { DashboardListCard } from './dashboard-list-card'
import { DashboardListRow } from './dashboard-list-row'
import type { ManagedDashboard } from '@/types/managed-dashboard'

type ViewMode = 'grid' | 'list'

export function DashboardList() {
  const { data: dashboards = [], isLoading } = useManagedDashboards()
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ManagedDashboard | null>(null)

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return dashboards
    const q = searchQuery.toLowerCase()
    return dashboards.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    )
  }, [dashboards, searchQuery])

  const isEmpty = !isLoading && dashboards.length === 0 && !searchQuery

  return (
    <div className="space-y-4">
      {!isEmpty && (
        <DashboardListToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[56px] rounded-lg" />
            ))}
          </div>
        )
      ) : isEmpty ? (
        <Empty className="border rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutDashboard />
            </EmptyMedia>
            <EmptyTitle>No dashboards yet</EmptyTitle>
            <EmptyDescription>
              Create your first dashboard to start visualizing reconciliation
              data. Add charts, KPIs, and filters from your libraries.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => navigate({ to: '/dashboards/new' })}
            >
              <Plus className="mr-1.5 size-3.5" />
              Create Dashboard
            </Button>
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty className="border rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>No dashboards matching &ldquo;{searchQuery}&rdquo;</EmptyTitle>
            <EmptyDescription>Try a different search term or clear your filters.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((dashboard, i) => (
                  <DashboardListCard
                    key={dashboard.id}
                    dashboard={dashboard}
                    index={i}
                    onClick={() =>
                      navigate({
                        to: '/dashboards/$dashboardId',
                        params: { dashboardId: dashboard.id },
                      })
                    }
                    onDelete={() => setDeleteTarget(dashboard)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((dashboard, i) => (
                  <DashboardListRow
                    key={dashboard.id}
                    dashboard={dashboard}
                    index={i}
                    onClick={() =>
                      navigate({
                        to: '/dashboards/$dashboardId',
                        params: { dashboardId: dashboard.id },
                      })
                    }
                    onDelete={() => setDeleteTarget(dashboard)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <DeleteDashboardDialog
        dashboard={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />
    </div>
  )
}
