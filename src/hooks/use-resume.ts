'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import type { ResumeRecord } from '@/lib/types'
import { toast } from 'sonner'

export const resumeKeys = {
  list: ['resumes'] as const,
}

export function useResumeHistory() {
  return useQuery({
    queryKey: resumeKeys.list,
    queryFn: () => apiFetch<ResumeRecord[]>('/api/resume/history'),
    staleTime: 30_000,
  })
}

export function useUploadResume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiFetch<ResumeRecord>('/api/resume/history', {
        method: 'POST',
        body: fd,
        form: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: resumeKeys.list })
      toast.success('Resume analyzed successfully')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
