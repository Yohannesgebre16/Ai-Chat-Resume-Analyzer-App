'use client'

import { useRef, useState } from 'react'
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useResumeHistory, useUploadResume } from '@/hooks/use-resume'
import { useCreateSession } from '@/hooks/use-sessions'
import { useUIStore } from '@/lib/ui-store'
import { cn } from '@/lib/utils'
import type { ResumeRecord } from '@/lib/types'

export function ResumePanel() {
  const { data: resumes, isLoading } = useResumeHistory()
  const upload = useUploadResume()
  const createSession = useCreateSession()
  const setActiveSession = useUIStore((s) => s.setActiveSession)
  const setTab = useUIStore((s) => s.setTab)
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<ResumeRecord | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file: File) => {
    upload.mutate(file)
  }

  const chatAbout = (r: ResumeRecord) => {
    createSession.mutate(
      { resumeId: r.id, title: `Resume: ${r.fileName}` },
      {
        onSuccess: (s) => {
          setActiveSession(s.id)
          setTab('chat')
        },
      }
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Resume Analyzer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF, DOCX, or TXT resume for an instant AI evaluation.
          </p>
        </div>

        {/* uploader */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 px-6 py-10 text-center transition-colors',
            dragOver && 'border-primary bg-primary/5'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {upload.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </div>
          <p className="text-sm font-medium">
            {upload.isPending ? 'Analyzing your resume…' : 'Drop your resume here'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, or TXT · max 8 MB</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <FileText className="mr-2 h-4 w-4" /> Choose file
          </Button>
        </div>

        {/* history */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent analyses</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : !resumes || resumes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
              No analyses yet. Upload a resume to get started.
            </p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {resumes.map((r) => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-border/60 bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <p className="truncate text-sm font-medium">{r.fileName}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <ScoreBadge score={r.analysis.score} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                        View details
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => chatAbout(r)}
                        disabled={createSession.isPending}
                      >
                        <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Chat about it
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* details dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6">
              <FileText className="h-4 w-4" /> {selected?.fileName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              AI resume analysis details
            </DialogDescription>
          </DialogHeader>
          {selected && <AnalysisBody analysis={selected.analysis} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? 'text-emerald-600 dark:text-emerald-400'
    : score >= 50 ? 'text-amber-600 dark:text-amber-400'
    : 'text-destructive'
  return (
    <div className="flex flex-col items-end">
      <span className={cn('text-2xl font-bold tabular-nums', color)}>{score}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">ATS score</span>
    </div>
  )
}

function AnalysisBody({ analysis }: { analysis: ResumeRecord['analysis'] }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Overall ATS score</span>
          <span className="tabular-nums">{analysis.score}/100</span>
        </div>
        <Progress value={analysis.score} className="h-2" />
      </div>

      <Section
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        title="Strengths"
        items={analysis.strengths}
        empty="No strengths highlighted."
      />
      <Section
        icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        title="Weaknesses"
        items={analysis.weaknesses}
        empty="No weaknesses highlighted."
      />
      <Section
        icon={<Lightbulb className="h-4 w-4 text-primary" />}
        title="Suggestions"
        items={analysis.suggestions}
        empty="No suggestions."
      />
    </div>
  )
}

function Section({
  icon,
  title,
  items,
  empty,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
  empty: string
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
