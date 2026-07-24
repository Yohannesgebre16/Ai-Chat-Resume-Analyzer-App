'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import type { ChatSessionSummary, ChatSessionTree, SendMessageBody, SendMessageResult } from '@/lib/types'
import { useUIStore } from '@/lib/ui-store'
import { toast } from 'sonner'

export const sessionKeys = {
  list: ['sessions'] as const,
  tree: (id: string) => ['session', id] as const,
}

/** GET /api/chat/sessions */
export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.list,
    queryFn: () => apiFetch<ChatSessionSummary[]>('/api/chat/sessions'),
    staleTime: 10_000,
  })
}

/** Create a new session. */
export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input?: { title?: string; resumeId?: string | null }) =>
      apiFetch<{ id: string; title: string }>('/api/chat/session', {
        method: 'POST',
        body: input ?? {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionKeys.list })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/** Delete a session. */
export function useDeleteSession() {
  const qc = useQueryClient()
  const setActiveSession = useUIStore((s) => s.setActiveSession)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/chat/session/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: sessionKeys.list })
      const prev = qc.getQueryData<ChatSessionSummary[]>(sessionKeys.list)
      qc.setQueryData<ChatSessionSummary[]>(sessionKeys.list, (old) =>
        (old ?? []).filter((s) => s.id !== id)
      )
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(sessionKeys.list, ctx.prev)
      toast.error('Failed to delete conversation')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sessionKeys.list })
    },
  })
}

/** Rename a session. */
export function useRenameSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetch<{ id: string; title: string }>(`/api/chat/session/${id}`, {
        method: 'PATCH',
        body: { title },
      }),
    onMutate: async ({ id, title }) => {
      await qc.cancelQueries({ queryKey: sessionKeys.list })
      const prev = qc.getQueryData<ChatSessionSummary[]>(sessionKeys.list)
      qc.setQueryData<ChatSessionSummary[]>(sessionKeys.list, (old) =>
        (old ?? []).map((s) => (s.id === id ? { ...s, title } : s))
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(sessionKeys.list, ctx.prev)
      toast.error('Failed to rename conversation')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sessionKeys.list })
    },
  })
}

/** GET /api/chat/session/:id — full message tree. */
export function useSessionTree(sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? sessionKeys.tree(sessionId) : ['session', 'none'],
    queryFn: () => apiFetch<ChatSessionTree>(`/api/chat/session/${sessionId}`),
    enabled: !!sessionId,
    staleTime: 0,
  })
}

/** Send a message (supports parentMessageId + editedMessageId for branching). */
export function useSendMessage(sessionId: string | null) {
  const qc = useQueryClient()
  const setActiveLeaf = useUIStore((s) => s.setActiveLeaf)
  return useMutation({
    mutationFn: (input: SendMessageBody) =>
      apiFetch<SendMessageResult>('/api/chat/message', {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => {
      // refresh the tree + sidebar (title may have changed)
      if (sessionId) {
        qc.invalidateQueries({ queryKey: sessionKeys.tree(sessionId) })
        setActiveLeaf(sessionId, data.assistantMessage.id)
      }
      qc.invalidateQueries({ queryKey: sessionKeys.list })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
