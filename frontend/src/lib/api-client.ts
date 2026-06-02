// Default to empty string (relative paths) so the bundle works from any host
// when the backend serves the frontend same-origin. Override via
// VITE_API_BASE_URL=http://localhost:8000 at build time only if you're running
// the Vite dev server (5173) cross-origin to uvicorn (8000) during local dev.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export class ApiError extends Error {
  status: number
  code: string
  userMessage: string
  detail?: string
  retryAfter?: number

  constructor(status: number, body: unknown) {
    const parsed = typeof body === 'string' ? tryParseJson(body) : body
    const record = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    const errorCode = (record.error as string) ?? 'unknown'
    const message = (record.message as string) ?? `API error ${status}`
    const detail = (record.detail as string) ?? undefined
    const retryAfter = typeof record.retry_after === 'number' ? record.retry_after : undefined

    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = errorCode
    this.userMessage = message
    this.detail = detail
    this.retryAfter = retryAfter
  }
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function transformKeys(obj: unknown, skipKeys = new Set<string>()): unknown {
  if (Array.isArray(obj)) return obj.map((item) => transformKeys(item, skipKeys))
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => {
        const camelKey = snakeToCamel(k)
        // Don't transform values inside these keys — they contain DB column names
        if (skipKeys.has(k)) return [camelKey, v]
        return [camelKey, transformKeys(v, skipKeys)]
      }),
    )
  }
  return obj
}

const DATA_KEYS = new Set(['rows', 'columns', 'data', 'config'])

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, text)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  const json = await res.json()
  return transformKeys(json, DATA_KEYS) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
