import Anthropic from '@anthropic-ai/sdk'
import type { Intent } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface DetectResult {
  intent: Intent
  language: 'en' | 'bm' | 'zh'
  confidence: number
}

const DETECTION_SYSTEM = `You are a message classifier for a business AI assistant.
Classify the user's intent and language.

Intent options:
- browse_product: asking about products, services, pricing, features
- health_issue: describing health symptoms or seeking health advice
- book_session: wants to make a booking, appointment, or reservation
- faq: asking a frequently asked question
- general: general conversation, greeting, or unclear intent

Language options: en (English), bm (Bahasa Malaysia), zh (Chinese/Mandarin)

Return ONLY valid JSON: {"intent":"<intent>","language":"<lang>","confidence":0.0-1.0}`

export async function detectIntentAndLanguage(message: string): Promise<DetectResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      system: DETECTION_SYSTEM,
      messages: [{ role: 'user', content: message.slice(0, 1000) }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
    const parsed = JSON.parse(text) as { intent: string; language: string; confidence: number }

    const validIntents: Intent[] = ['browse_product', 'health_issue', 'book_session', 'faq', 'general']
    const intent = validIntents.includes(parsed.intent as Intent)
      ? (parsed.intent as Intent)
      : 'general'

    const validLangs = ['en', 'bm', 'zh'] as const
    const language = validLangs.includes(parsed.language as 'en' | 'bm' | 'zh')
      ? (parsed.language as 'en' | 'bm' | 'zh')
      : 'en'

    return { intent, language, confidence: parsed.confidence ?? 0.8 }
  } catch {
    return { intent: 'general', language: 'en', confidence: 0.5 }
  }
}
