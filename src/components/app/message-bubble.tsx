'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, RefreshCw, Pencil, Send, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BranchNav } from './branch-nav'
import { Markdown } from './markdown'
import { cn } from '@/lib/utils'
import type { MessageNode } from '@/lib/types'

interface MessageBubbleProps {
  node: MessageNode
  siblingIndex: number
  siblingTotal: number
  isLastOnPath: boolean
  onPrevBranch: () => void
  onNextBranch: () => void
  onRegenerate?: () => void
  onEdit?: (newContent: string) => void
  /** show typing dots instead of content (assistant placeholder) */
  isTyping?: boolean
  sending?: boolean
}

export function MessageBubble({
  node,
  siblingIndex,
  siblingTotal,
  isLastOnPath,
  onPrevBranch,
  onNextBranch,
  onRegenerate,
  onEdit,
  isTyping,
  sending,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.content)
  const isUser = node.role === 'user'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const startEdit = () => {
    setDraft(node.content)
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  const saveEdit = () => {
    const v = draft.trim()
    if (!v || v === node.content) {
      setEditing(false)
      return
    }
    onEdit?.(v)
    setEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('group flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* avatar */}
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        )}
      >
        {isUser ? 'You' : <Sparkles className="h-3.5 w-3.5" />}
      </div>

      {/* bubble + meta */}
      <div className={cn('flex min-w-0 max-w-[85%] flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative w-full rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          )}
        >
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                rows={3}
                className="min-h-[80px] resize-none border-none bg-background/20 p-0 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-0"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 px-2 text-xs">
                  <X className="mr-1 h-3 w-3" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} className="h-7 px-2 text-xs">
                  <Send className="mr-1 h-3 w-3" /> Send
                </Button>
              </div>
            </div>
          ) : isTyping ? (
            <div className="flex items-center gap-1 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current opacity-60" />
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{node.content}</p>
          ) : (
            <Markdown content={node.content} />
          )}
        </div>

        {/* action row */}
        {!editing && !isTyping && (
          <div
            className={cn(
              'mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
              isUser ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {siblingTotal > 1 && (
              <BranchNav
                index={siblingIndex}
                total={siblingTotal}
                onPrev={onPrevBranch}
                onNext={onNextBranch}
              />
            )}
            <button
              type="button"
              onClick={copy}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {isUser && onEdit && (
              <button
                type="button"
                onClick={startEdit}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {!isUser && isLastOnPath && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={sending}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Regenerate"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', sending && 'animate-spin')} />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
