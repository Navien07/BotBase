import { detectIntentAndLanguage } from '@/lib/rag/detect'
import type { PipelineContext, StepResult } from './types'

export async function step3Detect(ctx: PipelineContext): Promise<StepResult> {
  // If booking state is active — skip detection, intent is already 'book_session'
  if (ctx.bookingState) {
    ctx.detectedIntent = 'book_session'
    ctx.detectedLanguage = (ctx.language as 'en' | 'bm' | 'zh') ?? 'en'
    return {
      step: 3, name: 'detect',
      status: 'pass',
      durationMs: 0,
      data: { intent: 'book_session', language: ctx.detectedLanguage, source: 'booking_state' },
    }
  }

  const result = await detectIntentAndLanguage(ctx.message)

  ctx.detectedIntent = result.intent
  ctx.detectedLanguage = result.language

  // If bot has language lock, use bot's default language
  if (ctx.bot.tone_lock_language) {
    ctx.detectedLanguage = (ctx.bot.default_language ?? 'en') as 'en' | 'bm' | 'zh'
  }

  return {
    step: 3, name: 'detect',
    status: 'pass',
    durationMs: 0,
    data: {
      intent: result.intent,
      language: result.language,
      confidence: result.confidence,
      language_locked: ctx.bot.tone_lock_language,
    },
  }
}
