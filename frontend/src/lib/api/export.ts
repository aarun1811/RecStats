import type { ExportRequest, ExportStatusResponse } from '@/types/api'
import { api } from '@/lib/api-client'

export function requestExport(
  request: ExportRequest,
): Promise<{ jobId: string }> {
  return api.post<{ jobId: string }>('/export', request)
}

export function checkExportStatus(
  jobId: string,
): Promise<ExportStatusResponse> {
  return api.get<ExportStatusResponse>(`/export/${jobId}/status`)
}
