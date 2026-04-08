import type { DashboardConfig } from '@/types/dashboard-config'

export interface ManagedDashboard {
  id: string
  name: string
  description: string
  config: DashboardConfig
  createdAt: string
  updatedAt: string
}

export interface DashboardCreate {
  name: string
  description: string
  config: DashboardConfig
}

export interface DashboardUpdate {
  name?: string
  description?: string
  config?: DashboardConfig
}
