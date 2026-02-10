import type { DashboardConfig } from '@/types/api'
import { api } from '@/lib/api-client'

interface DashboardListEnvelope {
  dashboards: DashboardConfig[]
  count: number
}

export async function fetchDashboards(): Promise<DashboardConfig[]> {
  const res = await api.get<DashboardListEnvelope>('/dashboards')
  return res.dashboards
}

export function fetchDashboard(id: string): Promise<DashboardConfig> {
  return api.get<DashboardConfig>(`/dashboards/${id}`)
}
