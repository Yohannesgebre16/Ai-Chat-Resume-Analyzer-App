import { db } from '@/lib/db'
import { comparePassword, signJwt } from '@/lib/auth'
import { ok, readJson, withErrors, HttpError } from '@/lib/api'
import type { SafeUser } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withErrors(async (req: Request) => {
  const body = await readJson<any>(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) throw new HttpError('Email and password are required', 422)

  const user = await db.user.findUnique({ where: { email } })
  if (!user) throw new HttpError('Invalid email or password', 401)
  const match = await comparePassword(password, user.password)
  if (!match) throw new HttpError('Invalid email or password', 401)

  const token = signJwt({ sub: user.id, email: user.email, name: user.name })
  const safe: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  }
  return ok({ user: safe, token })
})
