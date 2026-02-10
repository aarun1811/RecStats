import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  FileSpreadsheet,
  Download,
  Play,
  Pause,
  Trash2,
  Clock,
  Plus,
  FileBarChart,
} from 'lucide-react'

export const Route = createFileRoute('/reports/')({
  component: Reports,
})

interface MockReport {
  id: string
  name: string
  type: 'pdf' | 'excel'
  schedule: 'daily' | 'weekly' | 'monthly'
  status: 'active' | 'paused' | 'failed'
  lastGenerated: string
  dashboardId: string
}

const MOCK_REPORTS: MockReport[] = [
  {
    id: '1',
    name: 'Daily Break Summary',
    type: 'pdf',
    schedule: 'daily',
    status: 'active',
    lastGenerated: '2026-02-10 08:00',
    dashboardId: 'ops-dashboard',
  },
  {
    id: '2',
    name: 'Weekly Aging Report',
    type: 'excel',
    schedule: 'weekly',
    status: 'active',
    lastGenerated: '2026-02-07 06:00',
    dashboardId: 'ops-dashboard',
  },
  {
    id: '3',
    name: 'Monthly SLA Compliance',
    type: 'pdf',
    schedule: 'monthly',
    status: 'paused',
    lastGenerated: '2026-01-31 07:00',
    dashboardId: 'ops-dashboard',
  },
  {
    id: '4',
    name: 'FX Settlements Export',
    type: 'excel',
    schedule: 'daily',
    status: 'failed',
    lastGenerated: '2026-02-09 08:00',
    dashboardId: 'fx-dashboard',
  },
]

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function Reports() {
  const [reports] = useState(MOCK_REPORTS)

  const handleGenerate = async (report: MockReport) => {
    try {
      const endpoint = report.type === 'pdf' ? '/api/export/pdf' : '/api/export/excel'
      await api.post(endpoint, {
        format: report.type,
        dashboard_id: report.dashboardId,
        filters: {},
      })
      toast.success(`${report.type.toUpperCase()} export queued`, {
        description: `"${report.name}" is being generated.`,
      })
    } catch {
      toast.error('Export failed', {
        description: 'Could not queue the export. Try again.',
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled exports and on-demand report generation
          </p>
        </div>
        <Button>
          <Plus className="mr-2 size-4" />
          Schedule Report
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {report.type === 'pdf' ? (
                    <FileText className="size-5 text-red-500" />
                  ) : (
                    <FileSpreadsheet className="size-5 text-emerald-500" />
                  )}
                  <CardTitle className="text-sm font-medium leading-tight">
                    {report.name}
                  </CardTitle>
                </div>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-[10px] px-1.5 py-0 ${statusColors[report.status]}`}
                >
                  {report.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {report.schedule}
                </span>
                <span className="uppercase font-mono">{report.type}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Last generated: {report.lastGenerated}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleGenerate(report)}
                >
                  <Play className="mr-1 size-3" />
                  Generate Now
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  <Download className="mr-1 size-3" />
                  Download
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground">
                  {report.status === 'paused' ? (
                    <Play className="size-3" />
                  ) : (
                    <Pause className="size-3" />
                  )}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileBarChart className="size-12 mb-3 opacity-40" />
          <p className="font-medium">No reports yet</p>
          <p className="text-sm">Schedule your first report to get started.</p>
        </div>
      )}
    </div>
  )
}
