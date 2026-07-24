import { db } from '@/lib/db'
import { ok, withErrors, requireUser, HttpError } from '@/lib/api'
import type { SafeUser } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withErrors(async (req: Request) => {
  const current = await requireUser(req)
  const user = await db.user.findUnique({
    where: { id: current.id },
    select: { id: true, name: true, email: true, createdAt: true },
  })
  if (!user) throw new HttpError('User not found', 404)
  const safe: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  }
  return ok(safe)
})
