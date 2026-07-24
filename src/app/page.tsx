'use client'

import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { AuthScreen } from '@/components/app/auth-screen'
import { AppShell } from '@/components/app/app-shell'
import { ErrorBoundary } from '@/components/app/error-boundary'

export default function Home() {
  const status = useAuthStore((s) => s.status)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}
