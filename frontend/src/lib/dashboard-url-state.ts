import type { FilterValue } from '@/types/filter'

const FILTER_PREFIX = 'filter.'
const LOCK_KEY = 'filter.lock'
const HIDE_KEY = 'hide'

/**
 * Parse `?filter.X=Y` query params into a `Record<string, FilterValue>`.
 *
 * Comma-separated values become arrays (multi-select). The reserved
 * `filter.lock` key is skipped — use `parseLockedFilters` for that.
 *
 * NOTE: Multi-select values containing literal commas will be split incorrectly.
 * RecViz filter values (region, product, status) never contain commas in
 * practice. See 09-RESEARCH.md Pitfall 5.
 */
export function parseFilterParams(
  search: Record<string, unknown>,
): Record<string, FilterValue> {
  const out: Record<string, FilterValue> = {}
  for (const [key, val] of Object.entries(search)) {
    if (key === LOCK_KEY) continue
    if (key.startsWith(FILTER_PREFIX) && typeof val === 'string') {
      const filterId = key.slice(FILTER_PREFIX.length)
      out[filterId] = val.includes(',') ? val.split(',') : val
    }
  }
  return out
}

/**
 * Parse the reserved `filter.lock` key into an array of locked filter IDs.
 * Returns an empty array when the key is missing or empty.
 */
export function parseLockedFilters(
  search: Record<string, unknown>,
): string[] {
  const raw = search[LOCK_KEY]
  return typeof raw === 'string' && raw.length > 0 ? raw.split(',') : []
}

/**
 * Parse the `?hide=` query param into a Set of hide tokens
 * (e.g. `filter-bar`, `title`, `toolbar`).
 * Returns an empty Set when the key is missing or empty.
 */
export function parseHideTokens(
  search: Record<string, unknown>,
): Set<string> {
  const raw = search[HIDE_KEY]
  return typeof raw === 'string' && raw.length > 0
    ? new Set(raw.split(','))
    : new Set<string>()
}

/**
 * Serialize an applied filter map into a flat `Record<string, string>` of
 * `filter.<id>=<value>` query params suitable for `URLSearchParams` or
 * TanStack Router `navigate({ search })`.
 *
 * Null/undefined values and empty arrays are omitted (an empty array is
 * not a meaningful filter).
 */
export function serializeFilterParams(
  applied: Record<string, FilterValue>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [filterId, val] of Object.entries(applied)) {
    if (val == null) continue
    if (Array.isArray(val)) {
      if (val.length === 0) continue
      out[`${FILTER_PREFIX}${filterId}`] = val.join(',')
    } else {
      out[`${FILTER_PREFIX}${filterId}`] = String(val)
    }
  }
  return out
}

/**
 * Strip `filter.*` keys from a search-params object while preserving every
 * other key (e.g. `theme`, `hide`). Used by the bidirectional URL writer to
 * spread non-filter params through the new search object.
 */
export function stripFilterParams(
  prev: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(prev)) {
    if (!k.startsWith(FILTER_PREFIX)) out[k] = v
  }
  return out
}

/**
 * Build a shareable URL from a pathname and an applied filter map.
 * Returns the pathname unchanged when there are no filters to encode.
 */
export function buildShareUrl(
  pathname: string,
  applied: Record<string, FilterValue>,
): string {
  const params = serializeFilterParams(applied)
  const qs = new URLSearchParams(params).toString()
  return qs ? `${pathname}?${qs}` : pathname
}
