'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BranchNavProps {
  index: number // 0-based current position among siblings
  total: number
  onPrev: () => void
  onNext: () => void
  className?: string
}

/** Subtle `< 1/2 >` control shown on messages that have sibling branches. */
export function BranchNav({ index, total, onPrev, onNext, className }: BranchNavProps) {
  if (total <= 1) return null
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/80 px-1 py-0.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur',
        className
      )}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={index <= 0}
        aria-label="Previous branch"
        className="rounded p-0.5 transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="tabular-nums">
        {index + 1}/{total}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={index >= total - 1}
        aria-label="Next branch"
        className="rounded p-0.5 transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  )
}
