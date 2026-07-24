import { db } from '@/lib/db'
import { ok, withErrors, requireUser } from '@/lib/api'
import { analyzeResume } from '@/lib/ai'
import type { ResumeRecord, ResumeAnalysis } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeText(str: string): string {
  return str
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 1. GET: Fetch resume history for current user
export async function GET(req: Request) {
  return withErrors(async (req: Request) => {
    const user = await requireUser(req)
    const rows = await db.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const records: ResumeRecord[] = rows.map((r) => {
      let analysis: ResumeAnalysis = { score: 0, strengths: [], weaknesses: [], suggestions: [] }
      try {
        analysis = JSON.parse(r.analysis)
      } catch {
        /* keep default */
      }
      return {
        id: r.id,
        fileName: r.fileName,
        mimeType: r.mimeType,
        analysis,
        createdAt: r.createdAt.toISOString(),
      }
    })

    return ok(records)
  })(req)
}

// 2. POST: Process uploaded PDF or JSON data & analyze
export async function POST(req: Request) {
  return withErrors(async (req: Request) => {
    const user = await requireUser(req)

    let fileName = 'resume.pdf'
    let mimeType = 'application/pdf'
    let text = ''

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const textParam = formData.get('text') as string | null

      if (file) {
        fileName = file.name
        mimeType = file.type || mimeType

        if (textParam && textParam.trim().length > 0) {
          text = textParam
        } else {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          try {
            const pdfParse = (await import('pdf-parse-fork')).default
            const parsedPdf = await pdfParse(buffer)
            text = parsedPdf.text
          } catch (pdfErr) {
            console.error('PDF parsing failed:', pdfErr)
          }
        }
      } else if (textParam) {
        text = textParam
      }
    } else {
      const body = await req.json()
      fileName = body.fileName || fileName
      mimeType = body.mimeType || mimeType
      text = body.text || ''
    }

    text = sanitizeText(text)

    if (!text || text.length < 10) {
      throw new Error('Could not extract readable text from the uploaded PDF.')
    }

    // Analyze text with AI
    const analysis: ResumeAnalysis = await analyzeResume(text)

    const createdText = text.slice(0, 15000)

    const created = await db.resume.create({
      data: {
        userId: user.id,
        fileName,
        mimeType,
        extractedText: createdText,
        analysis: JSON.stringify(analysis),
      },
    })

    const record: ResumeRecord = {
      id: created.id,
      fileName: created.fileName,
      mimeType: created.mimeType,
      analysis,
      createdAt: created.createdAt.toISOString(),
    }

    return ok(record)
  })(req)
}