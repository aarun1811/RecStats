import type { GlobalFilters } from '@/types/filter'

/** Serialize global filters into Superset-compatible filter format */
export function toSupersetFilters(filters: GlobalFilters) {
  const result: { col: string; op: string; val: unknown }[] = []

  if (filters.dateRange.from && filters.dateRange.to) {
    result.push({
      col: 'date',
      op: 'BETWEEN',
      val: [
        filters.dateRange.from.toISOString().split('T')[0],
        filters.dateRange.to.toISOString().split('T')[0],
      ],
    })
  }

  if (filters.entities.length > 0) {
    result.push({ col: 'entity', op: 'IN', val: filters.entities })
  }

  if (filters.statuses.length > 0) {
    result.push({ col: 'status', op: 'IN', val: filters.statuses })
  }

  if (filters.desks.length > 0) {
    result.push({ col: 'desk', op: 'IN', val: filters.desks })
  }

  return result
}

/** Encode filters into URL search params for shareable links */
export function filtersToSearchParams(filters: GlobalFilters): URLSearchParams {
  const params = new URLSearchParams()
  params.set('from', filters.dateRange.from.toISOString())
  params.set('to', filters.dateRange.to.toISOString())
  if (filters.entities.length) params.set('entities', filters.entities.join(','))
  if (filters.statuses.length) params.set('statuses', filters.statuses.join(','))
  if (filters.desks.length) params.set('desks', filters.desks.join(','))
  return params
}

/** Decode URL search params back to filters */
export function searchParamsToFilters(params: URLSearchParams): Partial<GlobalFilters> {
  const filters: Partial<GlobalFilters> = {}

  const from = params.get('from')
  const to = params.get('to')
  if (from && to) {
    filters.dateRange = { from: new Date(from), to: new Date(to) }
  }

  const entities = params.get('entities')
  if (entities) filters.entities = entities.split(',')

  const statuses = params.get('statuses')
  if (statuses) filters.statuses = statuses.split(',')

  const desks = params.get('desks')
  if (desks) filters.desks = desks.split(',')

  return filters
}
