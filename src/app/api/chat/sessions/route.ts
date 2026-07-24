import { db } from '@/lib/db'
import { ok, withErrors, requireUser } from '@/lib/api'
import type { ChatSessionSummary } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/chat/sessions — retrieve the user's chat history sidebar list. */
export const GET = withErrors(async (req: Request) => {
  const user = await requireUser(req)
  const sessions = await db.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      resumeId: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true },
      },
    },
  })

  const summaries: ChatSessionSummary[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    resumeId: s.resumeId,
    lastMessagePreview: s.messages[0]?.content?.slice(0, 120) ?? '',
  }))
  return ok(summaries)
})
