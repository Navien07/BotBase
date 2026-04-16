import { buildFaqContext, buildRagContext, buildLiveApiContext, estimateTokenCount } from '@/lib/rag/prompt'
import type { PipelineContext, StepResult } from './types'

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  bm: 'Bahasa Malaysia',
  zh: 'Mandarin Chinese',
}

export async function step9Prompt(ctx: PipelineContext): Promise<StepResult> {
  const bot = ctx.bot
  const lang = ctx.detectedLanguage ?? ctx.bot.default_language ?? 'en'
  const parts: string[] = []

  // 1. Base personality
  if (bot.system_prompt) {
    parts.push(bot.system_prompt)
  }

  // 2. Language instruction
  const langLabel = LANGUAGE_LABELS[lang] ?? 'English'
  parts.push(`Always respond in ${langLabel}. Do not switch languages unless the user explicitly asks.`)

  // 3. Tone instructions
  const toneInstructions: string[] = []
  if (bot.tone_formal) toneInstructions.push('Use formal, professional language.')
  if (bot.tone_verbose) toneInstructions.push('Provide detailed, comprehensive responses.')
  else toneInstructions.push('Be concise and clear.')
  if (bot.tone_emoji) toneInstructions.push('You may use emojis sparingly to be friendly.')
  else toneInstructions.push('Do not use emojis.')
  if (toneInstructions.length > 0) parts.push(toneInstructions.join(' '))

  // 4. Guardrails — in-scope topics
  const inScope = bot.guardrail_rules?.in_scope ?? []
  if (inScope.length > 0) {
    parts.push(`You are designed to answer questions about:\n${inScope.map((r) => `- ${r}`).join('\n')}`)
  }

  // 5. Guardrails — important rules
  const important = bot.guardrail_rules?.important ?? []
  if (important.length > 0) {
    parts.push(`Important rules:\n${important.map((r) => `- ${r}`).join('\n')}`)
  }

  // 5. Fact grounding
  if (bot.fact_grounding) {
    parts.push('Only state facts that are provided in the knowledge base or conversation context. If unsure, say so.')
  }
  if (bot.hallucination_guard) {
    parts.push('Never make up information, URLs, phone numbers, prices, or dates. Only use information provided to you.')
  }

  // 6. FAQ context
  if (ctx.faqResult) {
    parts.push(buildFaqContext(ctx.faqResult))
  }

  // 7. RAG context
  if (ctx.ragChunks.length > 0) {
    parts.push(buildRagContext(ctx.ragChunks))
  }

  // 8. Live API data
  if (ctx.liveApiData) {
    parts.push(buildLiveApiContext(ctx.liveApiData))
  }

  // 9. Booking guardrail — prevent LLM from simulating the booking flow
  if (bot.feature_flags?.booking_enabled) {
    parts.push(
      'IMPORTANT: Never collect booking details yourself or simulate a booking flow. ' +
      'If the user wants to make a booking or appointment, instruct them to say "I want to book" ' +
      'to start the automated booking system.'
    )
  }

  // 9b. File delivery guardrail — bot cannot send files
  parts.push(
    'You can only send text messages. Never tell the user you are sending, attaching, or delivering any PDF, ' +
    'file, brochure, or document. If product information is needed, summarise it in your text response.'
  )

  // 10. Response length instructions
  const minWords = bot.response_min_words ?? 20
  const maxWords = bot.response_max_words ?? 300
  parts.push(`Keep responses between ${minWords} and ${maxWords} words.`)

  // 10. Format instructions
  parts.push('Format your response clearly. Use bullet points or numbered lists only when listing multiple items.')

  const systemPrompt = parts.filter(Boolean).join('\n\n')
  ctx.systemPrompt = systemPrompt

  return {
    step: 9, name: 'prompt',
    status: 'pass',
    durationMs: 0,
    data: {
      prompt_length: systemPrompt.length,
      estimated_tokens: estimateTokenCount(systemPrompt),
      faq_injected: !!ctx.faqResult,
      rag_chunks_injected: ctx.ragChunks.length,
      live_api_injected: !!ctx.liveApiData,
      system_prompt: systemPrompt,
    },
  }
}
