/**
 * Thin fetch wrapper that attaches the JWT, parses the { success, data, error }
 * envelope, and throws ApiError on failure so TanStack Query / mutations can
 * handle it uniformly.
 */
import type { ApiResponse } from './api'

const TOKEN_KEY = 'zai_chat_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** send as multipart/form-data (omit JSON content-type) */
  form?: boolean
}

export async function apiFetch<T = any>(
  path: string,
  opts: FetchOptions = {}
): Promise<T> {
  const { body, form, headers, ...rest } = opts
  const token = getToken()
  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  }
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`

  let payload: BodyInit | undefined
  if (body !== undefined && body !== null) {
    if (form) {
      payload = body as BodyInit
    } else {
      finalHeaders['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }
  }

  let res: Response
  try {
    res = await fetch(path, {
      ...rest,
      headers: finalHeaders,
      body: payload,
    })
  } catch (e: any) {
    throw new ApiError(e?.message || 'Network error', 0)
  }

  let json: ApiResponse<T> | null = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try {
      json = (await res.json()) as ApiResponse<T>
    } catch {
      json = null
    }
  }

  if (!res.ok || !json) {
    const message =
      (json && (json as any).error) || `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }

  if (!json.success) {
    throw new ApiError(json.error || 'Unknown error', res.status)
  }
  return json.data as T
}
