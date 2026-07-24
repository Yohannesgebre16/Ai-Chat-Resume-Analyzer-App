/**
 * AI client wrappers (server-only).
 *
 * Supports TWO providers, switched by the AI_PROVIDER env var:
 *   - "zai"    → uses z-ai-web-dev-sdk
 *   - "gemini" → uses @google/generative-ai (for local PC + Vercel deployment)
 *
 * Set these env vars in .env.local when AI_PROVIDER=gemini:
 *   AI_PROVIDER    = gemini
 *   GEMINI_API_KEY = your Google AI Studio key
 *   GEMINI_MODEL   = gemini-2.0-flash
 */
import 'server-only'
import type { ResumeAnalysis } from './types'
import type { ChatMessage } from './ai-types'

export type { ChatMessage } from './ai-types'

type Provider = 'zai' | 'gemini'

function getProvider(): Provider {
  const p = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim()
  return p === 'gemini' ? 'gemini' : 'zai'
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

export async function analyzeResume(text: string): Promise<ResumeAnalysis> {
  const systemPrompt =
    'You are Shega AI, a professional HR resume evaluator. ' +
    'Analyze the resume text the user provides and respond with ONLY a valid JSON object ' +
    '(no markdown, no code fences, no commentary) in exactly this shape: ' +
    '{"score": number 0-100, "strengths": string[], "weaknesses": string[], "suggestions": string[]}.'
  const raw = await completeChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text.slice(0, 12000) },
  ])
  return parseResumeAnalysis(raw)
}

export async function generateChatReply(
  history: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  const messages: ChatMessage[] = []
  const defaultSystemPrompt =
    'You are Shega AI, a smart, friendly, and helpful AI assistant. Format answers with markdown when helpful.'
  
  messages.push({ role: 'system', content: systemPrompt || defaultSystemPrompt })
  messages.push(...history)
  return completeChat(messages)
}

export async function generateSessionTitle(firstUserMessage: string): Promise<string> {
  const raw = await completeChat([
    {
      role: 'system',
      content:
        'Generate a concise 3-6 word title (no quotes, no punctuation at the end) summarizing the user message. Reply with only the title.',
    },
    { role: 'user', content: firstUserMessage.slice(0, 500) },
  ])
  return raw.trim().replace(/^["'`]|["'`]$/g, '').slice(0, 60) || 'New Chat'
}

// ---------------------------------------------------------------------------
//  Provider routing
// ---------------------------------------------------------------------------

async function completeChat(messages: ChatMessage[]): Promise<string> {
  const provider = getProvider()
  if (provider === 'gemini') return completeWithGemini(messages)
  return completeWithZai(messages)
}

// ---------------------------------------------------------------------------
//  Z.ai provider
// ---------------------------------------------------------------------------

let _zai: any = null

async function completeWithZai(messages: ChatMessage[]): Promise<string> {
  if (!_zai) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    _zai = await ZAI.create()
  }
  const mapped = messages.map((m) => ({
    role: m.role === 'system' ? 'assistant' : m.role,
    content: m.content,
  }))
  const completion = await _zai.chat.completions.create({
    messages: mapped,
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
//  Google Gemini provider
// ---------------------------------------------------------------------------

let _geminiClient: any = null

async function completeWithGemini(messages: ChatMessage[]): Promise<string> {
  if (!_geminiClient) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini')
    _geminiClient = new GoogleGenerativeAI(apiKey)
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  // Extract system prompt & conversation history
  const systemMsgs = messages.filter((m) => m.role === 'system')
  const chatMsgs = messages.filter((m) => m.role !== 'system')
  const systemInstructionText = systemMsgs.map((m) => m.content).join('\n\n') || undefined

  // Pass systemInstruction properly formatted inside getGenerativeModel
  const model = _geminiClient.getGenerativeModel({
    model: modelName,
    ...(systemInstructionText
      ? {
          systemInstruction: {
            role: 'system',
            parts: [{ text: systemInstructionText }],
          },
        }
      : {}),
  })

  // Format chat history for Gemini
  const lastMsg = chatMsgs[chatMsgs.length - 1]
  const history = chatMsgs.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  if (!lastMsg) {
    const result = await model.generateContent(systemInstructionText || 'Hello')
    return result.response.text()
  }

  // Start chat WITHOUT passing systemInstruction inside startChat
  const chat = model.startChat({
    history,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  })

  const result = await chat.sendMessage(lastMsg.content)
  return result.response.text()
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function parseResumeAnalysis(raw: string): ResumeAnalysis {
  let cleaned = raw.trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) cleaned = fence[1].trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('AI did not return valid JSON for resume analysis')
  }
  const jsonStr = cleaned.slice(start, end + 1)
  let parsed: any
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('AI returned malformed JSON for resume analysis')
  }
  const score = Number.isFinite(parsed.score)
    ? Math.max(0, Math.min(100, Number(parsed.score)))
    : 0
  const asArr = (v: any): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []
  return {
    score,
    strengths: asArr(parsed.strengths),
    weaknesses: asArr(parsed.weaknesses),
    suggestions: asArr(parsed.suggestions),
  }
}