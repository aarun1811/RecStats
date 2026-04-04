export interface DashboardListItem {
  id: string
  name: string
  description?: string | null
  status?: 'active' | 'draft'
}
