import { db } from '@/lib/db'
import { hashPassword, signJwt } from '@/lib/auth'
import { ok, fail, readJson, withErrors, HttpError } from '@/lib/api'
import type { SafeUser } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function validateEmail(email: unknown): string {
  if (typeof email !== 'string') throw new HttpError('Email is required', 422)
  const normalized = email.trim().toLowerCase()
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(normalized)) throw new HttpError('Invalid email format', 422)
  return normalized
}

export const POST = withErrors(async (req: Request) => {
  const body = await readJson<any>(req)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = validateEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  if (name.length < 2) throw new HttpError('Name must be at least 2 characters', 422)
  if (password.length < 6) throw new HttpError('Password must be at least 6 characters', 422)

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) throw new HttpError('Email already registered', 409)

  const hashed = await hashPassword(password)
  const user = await db.user.create({ data: { name, email, password: hashed } })

  const token = signJwt({ sub: user.id, email: user.email, name: user.name })
  const safe: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  }
  return ok({ user: safe, token })
})
