/**
 * Unified API response helpers + error types for Next.js route handlers.
 * Every endpoint returns: { success: boolean, data?: T, error?: string }
 */
import { NextResponse } from 'next/server'
import { verifyJwt, type JwtPayload } from './auth'
import { db } from './db'

export interface ApiSuccess<T> {
  success: true
  data: T
}
export interface ApiError {
  success: false
  error: string
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data } as ApiSuccess<T>, { status })
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error } as ApiError, { status })
}

/** Parse a JSON body with a zod-safe manual guard; throws ApiError-like Error on bad input. */
export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    const text = await req.text()
    if (!text) return {} as T
    return JSON.parse(text) as T
  } catch {
    throw new HttpError('Invalid JSON body', 400)
  }
}

export class HttpError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/**
 * Require an authenticated user for a route. Returns the user record or throws.
 * Reads the `Authorization: Bearer <token>` header.
 */
export async function requireUser(req: Request): Promise<{
  id: string
  email: string
  name: string
}> {
  const auth = req.headers.get('authorization') || ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    throw new HttpError('Authorization required', 401)
  }
  const token = auth.slice(7).trim()
  let payload: JwtPayload
  try {
    payload = verifyJwt(token)
  } catch {
    throw new HttpError('Invalid or expired token', 401)
  }
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  })
  if (!user) throw new HttpError('User not found', 401)
  return user
}

/** Wrap a route handler with uniform try/catch -> { success, error } shape. */
export function withErrors(
  handler: (req: Request, ctx: any) => Promise<Response>
) {
  return async (req: Request, ctx: any): Promise<Response> => {
    try {
      return await handler(req, ctx)
    } catch (err: any) {
      if (err instanceof HttpError) {
        return fail(err.message, err.status)
      }
      console.error('[api error]', err)
      return fail(err?.message || 'Internal server error', 500)
    }
  }
}
