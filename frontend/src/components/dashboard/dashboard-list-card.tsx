import { formatDistanceToNow } from 'date-fns'
import { LayoutDashboard, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ManagedDashboard } from '@/types/managed-dashboard'

interface DashboardListCardProps {
  dashboard: ManagedDashboard
  onClick: () => void
  onDelete?: () => void
}

export function DashboardListCard({ dashboard, onClick, onDelete }: DashboardListCardProps) {
  const timeAgo = formatDistanceToNow(new Date(dashboard.updatedAt), {
    addSuffix: true,
  })

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5',
        'hover:border-primary/20',
      )}
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-9 rounded-md bg-muted/50 shrink-0">
            <LayoutDashboard className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{dashboard.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {dashboard.description || 'No description'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Updated {timeAgo}</p>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            title="Delete dashboard"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
