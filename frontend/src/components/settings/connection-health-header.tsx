import { formatDistanceToNow } from 'date-fns'

import type { DatabaseInfo } from '@/types/database'
import { AnimatedStatusBadge } from './animated-status-badge'

interface ConnectionHealthHeaderProps {
  database: DatabaseInfo
}

export function ConnectionHealthHeader({ database }: ConnectionHealthHeaderProps) {
  const lastTestedText = database.lastTested
    ? `Last tested ${formatDistanceToNow(new Date(database.lastTested), { addSuffix: true })}`
    : 'Never tested'

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Row 1: Status badge + last tested */}
      <div className="flex items-center justify-between">
        <AnimatedStatusBadge status={database.status} size="large" />
        <span className="text-xs text-muted-foreground">{lastTestedText}</span>
      </div>

      {/* Row 2: 2-column info grid */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div>
          <dt className="text-xs text-muted-foreground">Host</dt>
          <dd className="text-sm font-mono truncate">Configured</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Port</dt>
          <dd className="text-sm font-mono truncate">Configured</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Service Name</dt>
          <dd className="text-sm font-mono truncate">Configured</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Schema</dt>
          <dd className="text-sm font-mono truncate">Configured</dd>
        </div>
      </dl>
    </div>
  )
}
