/**
 * Client-side branching-tree helpers (pure, no DB). Mirrors the server logic
 * in src/lib/chat-tree.ts for in-browser branch navigation.
 */
import type { MessageNode } from './types'

export function findRoot(nodes: MessageNode[]): MessageNode | null {
  return nodes.find((n) => n.parentMessageId === null) ?? null
}

export function byId(nodes: MessageNode[]): Map<string, MessageNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

/** All siblings of a message (same parent), ordered by siblingIndex. */
export function siblingsOf(nodes: MessageNode[], messageId: string): MessageNode[] {
  const map = byId(nodes)
  const target = map.get(messageId)
  if (!target) return []
  const key = target.parentMessageId ?? '__root__'
  return nodes
    .filter((n) => (n.parentMessageId ?? '__root__') === key)
    .sort((a, b) => a.siblingIndex - b.siblingIndex)
}

/** Linear path from root to the given leaf id (inclusive). */
export function pathToLeaf(nodes: MessageNode[], leafId: string): MessageNode[] {
  const map = byId(nodes)
  const path: MessageNode[] = []
  let cur = map.get(leafId)
  while (cur) {
    path.unshift(cur)
    cur = cur.parentMessageId ? map.get(cur.parentMessageId) : undefined
  }
  return path
}

/**
 * Deepest leaf reachable from `startId`, always preferring the child with the
 * highest siblingIndex (the latest branch). Used to compute the visible leaf
 * after switching branches.
 */
export function subtreeLeaf(nodes: MessageNode[], startId: string): string {
  const map = byId(nodes)
  let cur = map.get(startId)
  if (!cur) return startId
  while (cur.childrenMessageIds.length > 0) {
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

/** Default active leaf for a freshly loaded tree (latest branch from latest root). */
export function defaultLeaf(nodes: MessageNode[]): string | null {
  const roots = nodes.filter((n) => n.parentMessageId === null)
  if (roots.length === 0) return null
  roots.sort((a, b) => a.siblingIndex - b.siblingIndex)
  return subtreeLeaf(nodes, roots[roots.length - 1].id)
}
