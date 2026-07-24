import { db } from '@/lib/db'
import { ok, readJson, withErrors, requireUser, HttpError } from '@/lib/api'
import {
  loadSessionNodes,
  computeActiveLeaf,
  pathToLeaf,
  attachMessage,
  attachSiblingBranch,
} from '@/lib/chat-tree'
import { generateChatReply, generateSessionTitle } from '@/lib/ai'
import type { MessageNode, SendMessageBody, SendMessageResult } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withErrors(async (req: Request) => {
  const user = await requireUser(req)
  const body = await readJson<SendMessageBody>(req)

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const hasRegenerate =
    typeof body.regenerateAssistantId === 'string' && body.regenerateAssistantId.trim()
  if (!sessionId) throw new HttpError('sessionId is required', 422)
  if (!hasRegenerate && !content) throw new HttpError('content is required', 422)
  if (content.length > 8000) throw new HttpError('Message too long (max 8000 chars)', 422)

  const session = await db.chatSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== user.id) {
    throw new HttpError('Session not found', 404)
  }

  const editedMessageId =
    typeof body.editedMessageId === 'string' && body.editedMessageId.trim()
      ? body.editedMessageId.trim()
      : null
  const regenerateAssistantId =
    typeof body.regenerateAssistantId === 'string' && body.regenerateAssistantId.trim()
      ? body.regenerateAssistantId.trim()
      : null
  const explicitParent =
    typeof body.parentMessageId === 'string' && body.parentMessageId.trim()
      ? body.parentMessageId.trim()
      : null

  // ----- 1. attach the user message into the tree ------------------------
  let userMessage: MessageNode | undefined
  let parentForAssistant: string | null
  let isFirstMessage: boolean

  const existing = await loadSessionNodes(sessionId)
  isFirstMessage = existing.length === 0

  if (regenerateAssistantId) {
    const target = existing.find((n) => n.id === regenerateAssistantId)
    if (!target) throw new HttpError('Message to regenerate not found', 404)
    if (target.role !== 'assistant') throw new HttpError('Only assistant messages can be regenerated', 422)
    parentForAssistant = target.parentMessageId
  } else if (editedMessageId) {
    const target = existing.find((n) => n.id === editedMessageId)
    if (!target) throw new HttpError('Message to edit not found', 404)
    if (target.role !== 'user') throw new HttpError('Only user messages can be edited', 422)
    userMessage = await attachSiblingBranch({
      sessionId,
      role: 'user',
      content,
      siblingOfMessageId: editedMessageId,
    })
    parentForAssistant = userMessage.id
  } else if (explicitParent) {
    const parent = existing.find((n) => n.id === explicitParent)
    if (!parent) throw new HttpError('parentMessageId not found in this session', 404)
    userMessage = await attachMessage({
      sessionId,
      role: 'user',
      content,
      parentMessageId: explicitParent,
    })
    parentForAssistant = userMessage.id
  } else {
    const leafId = computeActiveLeaf(existing)
    userMessage = await attachMessage({
      sessionId,
      role: 'user',
      content,
      parentMessageId: leafId,
    })
    parentForAssistant = userMessage.id
  }

  // ----- 2. build linear conversation history (root -> parentForAssistant)
  const refreshed = await loadSessionNodes(sessionId)
  const path = pathToLeaf(refreshed, parentForAssistant ?? '')
  const history = path
    .filter((n) => n.role === 'user' || n.role === 'assistant')
    .map((n) => ({ role: n.role as 'user' | 'assistant', content: n.content }))

  // ----- 3. Shega AI System Prompt ---------------------
  let systemPrompt =
    'You are Shega AI, a smart, friendly, and helpful AI assistant. Format answers with markdown when helpful.'
  if (session.resumeId) {
    const resume = await db.resume.findUnique({ where: { id: session.resumeId } })
    if (resume) {
      let analysis: any = {}
      try {
        analysis = JSON.parse(resume.analysis)
      } catch {
        analysis = {}
      }
      const score = typeof analysis.score === 'number' ? analysis.score : 'n/a'
      systemPrompt =
        'You are Shega AI, an expert AI career coach helping the user with their resume. ' +
        `Resume file: ${resume.fileName}. ATS score: ${score}. ` +
        'Reference the resume content below to give specific, actionable feedback. ' +
        'Be concise and use markdown.\n\n--- RESUME TEXT ---\n' +
        resume.extractedText.slice(0, 6000)
    }
  }

  // ----- 4. generate assistant reply --------------------------------------
  let reply = ''
  try {
    reply = await generateChatReply(history, systemPrompt)
  } catch (e: any) {
    reply = `⚠️ I couldn't generate a response right now. (${e?.message || 'AI error'})`
  }
  const assistantMessage = await attachMessage({
    sessionId,
    role: 'assistant',
    content: reply,
    parentMessageId: parentForAssistant,
    model: 'gemini-2.0-flash',
  })

  // ----- 5. auto-title on first message -----------------------------------
  if (isFirstMessage && userMessage) {
    try {
      const title = await generateSessionTitle(userMessage.content)
      await db.chatSession.update({ where: { id: sessionId }, data: { title } })
    } catch {
      // keep default title
    }
  }

  await db.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } })

  const result: SendMessageResult = { userMessage, assistantMessage }
  return ok(result)
})