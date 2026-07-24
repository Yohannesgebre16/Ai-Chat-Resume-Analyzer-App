/**
 * Branching-tree helpers for chat messages.
 * The tree is encoded with parentMessageId + siblingIndex + childrenIds(JSON).
 * These helpers build/derive the tree, compute the active linear branch, and
 * attach new messages (including edit/regenerate branches).
 */
import { db } from './db'
import type { MessageNode, MessageRole } from './types'

function rowToNode(row: any): MessageNode {
  let children: string[] = []
  try {
    children = JSON.parse(row.childrenIds || '[]')
  } catch {
    children = []
  }
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    parentMessageId: row.parentMessageId,
    childrenMessageIds: children,
    siblingIndex: row.siblingIndex,
    model: row.model,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Load all messages of a session as nodes (children arrays populated). */
export async function loadSessionNodes(sessionId: string): Promise<MessageNode[]> {
  const rows = await db.message.findMany({
    where: { sessionId },
    orderBy: [{ parentMessageId: 'asc' }, { siblingIndex: 'asc' }, { createdAt: 'asc' }],
  })
  const nodes = rows.map(rowToNode)
  // Re-derive children ids from parent pointers for consistency (single source of truth)
  const byParent = new Map<string, MessageNode[]>()
  for (const n of nodes) {
    const key = n.parentMessageId ?? '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n)
  }
  for (const n of nodes) {
    const kids = byParent.get(n.id) ?? []
    kids.sort((a, b) => a.siblingIndex - b.siblingIndex)
    n.childrenMessageIds = kids.map((k) => k.id)
  }
  return nodes
}

/** Find the root message of a session (parentMessageId === null). */
export function findRoot(nodes: MessageNode[]): MessageNode | null {
  return nodes.find((n) => n.parentMessageId === null) ?? null
}

/**
 * Walk DOWN from a node to the "last selected" leaf, always preferring the
 * child whose siblingIndex is highest (most recent branch). This gives the
 * active branch path. Returns the leaf id.
 */
export function computeActiveLeaf(nodes: MessageNode[]): string | null {
  const map = new Map(nodes.map((n) => [n.id, n]))
  const roots = nodes.filter((n) => n.parentMessageId === null)
  if (roots.length === 0) return null
  // start from the most recent top-level message (highest siblingIndex)
  roots.sort((a, b) => a.siblingIndex - b.siblingIndex)
  let cur = roots[roots.length - 1]
  while (cur.childrenMessageIds.length > 0) {
    // pick the child with the highest siblingIndex (latest branch) that exists
    let best: MessageNode | null = null
    for (const cid of cur.childrenMessageIds) {
      const child = map.get(cid)
      if (!child) continue
      if (!best || child.siblingIndex > best.siblingIndex) best = child
    }
    if (!best) break
    cur = best
  }
  return cur.id
}

/** Build the linear path from root to a given leaf id (inclusive). */
export function pathToLeaf(nodes: MessageNode[], leafId: string): MessageNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]))
  const path: MessageNode[] = []
  let cur = map.get(leafId)
  while (cur) {
    path.unshift(cur)
    cur = cur.parentMessageId ? map.get(cur.parentMessageId) : undefined
  }
  return path
}

/** Get all siblings of a message (same parent), ordered by siblingIndex. */
export function siblingsOf(nodes: MessageNode[], messageId: string): MessageNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]))
  const target = map.get(messageId)
  if (!target) return []
  const key = target.parentMessageId ?? '__root__'
  return nodes
    .filter((n) => (n.parentMessageId ?? '__root__') === key)
    .sort((a, b) => a.siblingIndex - b.siblingIndex)
}

export interface AttachOptions {
  sessionId: string
  role: MessageRole
  content: string
  parentMessageId: string | null
  model?: string | null
}

/**
 * Attach a new message as a child of `parentMessageId` (or root if null).
 * Computes the next siblingIndex and updates the parent's childrenIds JSON.
 * Returns the created node.
 */
export async function attachMessage(opts: AttachOptions): Promise<MessageNode> {
  const { sessionId, role, content, parentMessageId, model } = opts
  // next sibling index among children of the same parent
  const siblings = await db.message.findMany({
    where: { sessionId, parentMessageId: parentMessageId ?? null },
    select: { siblingIndex: true },
  })
  const nextIndex = siblings.length
  const created = await db.message.create({
    data: {
      sessionId,
      role,
      content,
      parentMessageId: parentMessageId ?? null,
      siblingIndex: nextIndex,
      childrenIds: '[]',
      model: model ?? null,
    },
  })
  // update parent's childrenIds json
  if (parentMessageId) {
    const parent = await db.message.findUnique({ where: { id: parentMessageId } })
    if (parent) {
      let kids: string[] = []
      try {
        kids = JSON.parse(parent.childrenIds || '[]')
      } catch {
        kids = []
      }
      kids.push(created.id)
      await db.message.update({
        where: { id: parentMessageId },
        data: { childrenIds: JSON.stringify(kids) },
      })
    }
  }
  return rowToNode(created)
}

/**
 * Create a sibling branch of `editedMessageId` with new content (for edits).
 * The new message shares the same parent; siblingIndex is next available.
 */
export async function attachSiblingBranch(opts: {
  sessionId: string
  role: MessageRole
  content: string
  siblingOfMessageId: string
  model?: string | null
}): Promise<MessageNode> {
  const { sessionId, role, content, siblingOfMessageId, model } = opts
  const original = await db.message.findUnique({ where: { id: siblingOfMessageId } })
  if (!original) throw new Error('Message to branch from not found')
  const siblings = await db.message.findMany({
    where: { sessionId, parentMessageId: original.parentMessageId },
    select: { siblingIndex: true },
  })
  const nextIndex = siblings.length
  const created = await db.message.create({
    data: {
      sessionId,
      role,
      content,
      parentMessageId: original.parentMessageId,
      siblingIndex: nextIndex,
      childrenIds: '[]',
      model: model ?? null,
    },
  })
  // update parent's childrenIds json (if has parent)
  if (original.parentMessageId) {
    const parent = await db.message.findUnique({ where: { id: original.parentMessageId } })
    if (parent) {
      let kids: string[] = []
      try {
        kids = JSON.parse(parent.childrenIds || '[]')
      } catch {
        kids = []
      }
      if (!kids.includes(created.id)) kids.push(created.id)
      await db.message.update({
        where: { id: original.parentMessageId },
        data: { childrenIds: JSON.stringify(kids) },
      })
    }
  }
  return rowToNode(created)
}
