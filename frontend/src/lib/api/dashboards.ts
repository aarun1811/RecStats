import type { DashboardConfig } from '@/types/api'
import { api } from '@/lib/api-client'

export function fetchDashboards(): Promise<DashboardConfig[]> {
  return api.get<DashboardConfig[]>('/dashboards')
}

export function fetchDashboard(id: string): Promise<DashboardConfig> {
  return api.get<DashboardConfig>(`/dashboards/${id}`)
}
