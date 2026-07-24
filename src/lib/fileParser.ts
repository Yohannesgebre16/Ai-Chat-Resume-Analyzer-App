/**
 * Server-only file text extraction for PDF / DOCX / TXT.
 * Uses pdf-parse v2 (PDFParse class) + mammoth.
 */
import 'server-only'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export const ALLOWED_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
} as const

export const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 MB (Vercel serverless body limit safe)

export async function extractTextFromFile(
  mime: string,
  buffer: Buffer
): Promise<string> {
  if (mime === ALLOWED_MIME.pdf) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return (result?.text || '').trim()
  }
  if (mime === ALLOWED_MIME.docx) {
    const result = await mammoth.extractRawText({ buffer })
    return (result?.value || '').trim()
  }
  if (mime === ALLOWED_MIME.txt) {
    return buffer.toString('utf-8').trim()
  }
  throw new Error('Unsupported file type. Only PDF, DOCX or TXT allowed.')
}
