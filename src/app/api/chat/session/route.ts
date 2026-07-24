import { db } from '@/lib/db'
import { ok, readJson, withErrors, requireUser, HttpError } from '@/lib/api'
import { generateSessionTitle } from '@/lib/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/chat/session — create a new conversation thread. */
export const POST = withErrors(async (req: Request) => {
  const user = await requireUser(req)
  let body: any = {}
  try {
    body = await readJson<any>(req)
  } catch {
    body = {}
  }
  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 80)
      : 'New Chat'
  const resumeId = typeof body.resumeId === 'string' ? body.resumeId : null

  if (resumeId) {
    const resume = await db.resume.findUnique({ where: { id: resumeId } })
    if (!resume || resume.userId !== user.id) {
      throw new HttpError('Resume not found', 404)
    }
  }

  const session = await db.chatSession.create({
    data: { userId: user.id, title, resumeId },
  })
  return ok({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    resumeId: session.resumeId,
  })
})
