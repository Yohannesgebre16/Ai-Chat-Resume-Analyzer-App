/** Shared domain types used by both API routes and the frontend. */

export interface ResumeAnalysis {
  score: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

export interface SafeUser {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface ResumeRecord {
  id: string
  fileName: string
  mimeType: string
  analysis: ResumeAnalysis
  createdAt: string
}

export interface ChatSessionSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessagePreview: string
  resumeId: string | null
}

export type MessageRole = 'user' | 'assistant'

/** A message node in the branching tree. */
export interface MessageNode {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  parentMessageId: string | null
  childrenMessageIds: string[]
  siblingIndex: number
  model: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatSessionTree {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  resumeId: string | null
  messages: MessageNode[]
  /** id of the message currently visible at the leaf of the active branch */
  activeLeafId: string | null
}

/** Body for POST /api/chat/message */
export interface SendMessageBody {
  sessionId: string
  content: string
  /** parent message id — defines where in the tree this message attaches.
   *  null/undefined attaches to the root (first message of a new session). */
  parentMessageId?: string | null
  /** when editing a user prompt, the id of the user message being replaced
   *  (creates a sibling branch). */
  editedMessageId?: string | null
  /** when regenerating an AI reply, the id of the assistant message to replace
   *  (creates a sibling assistant branch using the same parent user message). */
  regenerateAssistantId?: string | null
}

export interface SendMessageResult {
  userMessage?: MessageNode
  assistantMessage: MessageNode
}
