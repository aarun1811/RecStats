const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(`API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
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

const DATA_KEYS = new Set(['rows', 'columns'])

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

  const json = await res.json()
  return transformKeys(json, DATA_KEYS) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
