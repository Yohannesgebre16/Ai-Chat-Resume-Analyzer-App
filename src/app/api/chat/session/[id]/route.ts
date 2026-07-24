import { db } from '@/lib/db'
import { ok, readJson, withErrors, requireUser, HttpError } from '@/lib/api'
import { loadSessionNodes, computeActiveLeaf } from '@/lib/chat-tree'
import type { ChatSessionTree } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/chat/session/:id — fetch full message tree for a session. */
export const GET = withErrors(async (req: Request, ctx: any) => {
  const user = await requireUser(req)
  const { id } = await ctx.params
  if (!id) throw new HttpError('Session id required', 400)

  const session = await db.chatSession.findUnique({ where: { id } })
  if (!session || session.userId !== user.id) {
    throw new HttpError('Session not found', 404)
  }

  const nodes = await loadSessionNodes(id)
  const activeLeafId = computeActiveLeaf(nodes)

  const tree: ChatSessionTree = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    resumeId: session.resumeId,
    messages: nodes,
    activeLeafId,
  }
  return ok(tree)
})

/** DELETE /api/chat/session/:id — delete a conversation thread. */
export const DELETE = withErrors(async (req: Request, ctx: any) => {
  const user = await requireUser(req)
  const { id } = await ctx.params
  if (!id) throw new HttpError('Session id required', 400)

  const session = await db.chatSession.findUnique({ where: { id } })
  if (!session || session.userId !== user.id) {
    throw new HttpError('Session not found', 404)
  }
  await db.chatSession.delete({ where: { id } })
  return ok({ id })
})

/** PATCH /api/chat/session/:id — rename a thread title. */
export const PATCH = withErrors(async (req: Request, ctx: any) => {
  const user = await requireUser(req)
  const { id } = await ctx.params
  if (!id) throw new HttpError('Session id required', 400)

  const body = await readJson<any>(req)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 1) throw new HttpError('Title cannot be empty', 422)

  const session = await db.chatSession.findUnique({ where: { id } })
  if (!session || session.userId !== user.id) {
    throw new HttpError('Session not found', 404)
  }
  const updated = await db.chatSession.update({
    where: { id },
    data: { title: title.slice(0, 80) },
  })
  return ok({ id: updated.id, title: updated.title })
})
