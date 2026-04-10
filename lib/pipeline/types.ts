import type { Bot } from '@/types/database'

export interface PipelineContext {
  botId: string
  conversationId: string
  contactId: string | null
  message: string
  userId: string
  channel: string
  bot: Bot
  language: string
  startedAt: number
  // Accumulated across steps:
  history: HistoryTurn[]
  detectedIntent: string | null
  detectedLanguage: string | null
  messageEmbedding: number[] | null  // cached from step-5, reused in step-6
  faqResult: FAQResult | null
  ragChunks: RAGChunk[]
  liveApiData: Record<string, unknown> | null
  bookingState: BookingState | null
  activeScriptId: string | null
  systemPrompt: string | null
}

export interface StepResult {
  step: number
  name: string
  status: 'pass' | 'block' | 'skip' | 'error'
  durationMs: number
  data: Record<string, unknown>
  blockedResponse?: string
}

export interface PipelineResult {
  response: string | null
  isStream: boolean
  steps: StepResult[]
  intent: string | null
  language: string
  ragFound: boolean
  guardrailTriggered: boolean
  templateUsed: string | null
  bookingActive: boolean
  totalDurationMs: number
}

export interface HistoryTurn { role: 'user' | 'assistant'; content: string }
export interface FAQResult { question: string; answer: string; similarity: number }
export interface RAGChunk { id: string; content: string; similarity: number; documentId: string }
export interface BookingState { step: string; type: string; data: Record<string, unknown> }
