/** Chart color palette -- matches CSS --chart-1 through --chart-5 */
export const CHART_COLORS = {
  primary: 'hsl(220, 70%, 50%)',
  secondary: 'hsl(160, 60%, 45%)',
  tertiary: 'hsl(30, 80%, 55%)',
  quaternary: 'hsl(280, 65%, 60%)',
  quinary: 'hsl(340, 75%, 55%)',
} as const

export const CHART_COLOR_ARRAY = Object.values(CHART_COLORS)

/** Default query/cache timing */
export const QUERY_STALE_TIME = 5 * 60 * 1000   // 5 minutes
export const QUERY_GC_TIME = 30 * 60 * 1000     // 30 minutes

/** Pagination */
export const DEFAULT_PAGE_SIZE = 500
export const GRID_PAGE_SIZE = 100

/** API */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Breakpoints (desktop-first app, but useful for reference) */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const
