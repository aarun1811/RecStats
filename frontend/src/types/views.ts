export interface SavedView {
  id: string
  name: string
  dashboardId: string
  filters: Record<string, unknown>
  createdAt?: string | null
}

export interface SavedViewCreate {
  name: string
  dashboardId: string
  filters: Record<string, unknown>
}
