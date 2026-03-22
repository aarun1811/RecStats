import { useSqlHistory } from '@/hooks/use-sql-history'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Timeline,
  TimelineItem,
  TimelineHeader,
  TimelineTitle,
  TimelineContent,
  TimelineIndicator,
  TimelineSeparator,
} from '@/components/ui/timeline'
import { CheckCircle2, XCircle, Trash2, History } from 'lucide-react'

interface QueryHistoryProps {
  onLoadQuery: (sql: string) => void
}

export function QueryHistory({ onLoadQuery }: QueryHistoryProps) {
  const { data: history, isLoading } = useSqlHistory()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (!history?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
        <History className="size-10 opacity-30" />
        <p className="text-sm">No queries yet</p>
        <p className="text-xs">Run a query to see it here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <History className="size-4" />
          Query History
        </span>
        <span className="text-xs text-muted-foreground">{history.length} queries</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          <Timeline defaultValue={history.length}>
            {history.map((item, idx) => (
              <TimelineItem key={idx} step={idx + 1}>
                <TimelineSeparator />
                <TimelineIndicator>
                  {item.status === 'success' ? (
                    <CheckCircle2 className="size-3 text-green-500" />
                  ) : (
                    <XCircle className="size-3 text-destructive" />
                  )}
                </TimelineIndicator>
                <TimelineHeader>
                  <TimelineTitle>
                    <button
                      className="text-left text-xs font-mono hover:text-primary cursor-pointer truncate max-w-[300px] block"
                      onClick={() => onLoadQuery(item.sql)}
                      title="Click to load into editor"
                    >
                      {item.sql.length > 80 ? item.sql.slice(0, 80) + '...' : item.sql}
                    </button>
                  </TimelineTitle>
                </TimelineHeader>
                <TimelineContent>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant={item.status === 'success' ? 'outline' : 'destructive'}
                      className="text-[10px] h-4 px-1"
                    >
                      {item.status}
                    </Badge>
                    {item.rows != null && (
                      <span className="text-[10px] text-muted-foreground">
                        {item.rows} rows
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(item.executedAt)}
                    </span>
                  </div>
                  {item.error && (
                    <p className="text-[10px] text-destructive mt-1 truncate max-w-[300px]">
                      {item.error}
                    </p>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </div>
      </ScrollArea>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}
