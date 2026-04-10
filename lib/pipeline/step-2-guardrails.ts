import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import type { PipelineContext, StepResult } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function getDeflectionMessage(ctx: PipelineContext): Promise<string> {
  const supabase = createServiceClient()
  const lang = ctx.detectedLanguage ?? ctx.bot.default_language ?? 'en'

  const { data } = await supabase
    .from('response_templates')
    .select('content')
    .eq('bot_id', ctx.botId)
    .eq('intent', 'out_of_scope')
    .eq('language', lang)
    .single()

  return data?.content ?? "I'm sorry, I can only help with topics related to our services. Is there something specific I can assist you with?"
}

export async function step2Guardrails(ctx: PipelineContext): Promise<StepResult> {
  const message = ctx.message.toLowerCase()

  // 1. Keyword blocklist check
  const blocklist = ctx.bot.keyword_blocklist ?? []
  const blockedKeyword = blocklist.find((kw) => message.includes(kw.toLowerCase()))
  if (blockedKeyword) {
    const deflection = await getDeflectionMessage(ctx)
    return {
      step: 2, name: 'guardrails',
      status: 'block',
      durationMs: 0,
      data: { reason: 'keyword_blocklist', keyword: blockedKeyword },
      blockedResponse: deflection,
    }
  }

  // 2. Out-of-scope classification via Claude Haiku
  const outOfScope = ctx.bot.guardrail_rules?.out_of_scope ?? []
  if (outOfScope.length > 0) {
    const scopeList = outOfScope.join('\n- ')
    const system = `You are a content moderator. Determine if the user message is out-of-scope for a business assistant.

Out-of-scope topics:
- ${scopeList}

Return ONLY: {"blocked":true|false,"reason":"<brief reason if blocked>"}`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        system,
        messages: [{ role: 'user', content: ctx.message.slice(0, 500) }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
      const result = JSON.parse(text) as { blocked: boolean; reason?: string }

      if (result.blocked) {
        const deflection = await getDeflectionMessage(ctx)
        return {
          step: 2, name: 'guardrails',
          status: 'block',
          durationMs: 0,
          data: { reason: 'out_of_scope', detail: result.reason ?? '' },
          blockedResponse: deflection,
        }
      }
    } catch {
      // Fail open — don't block on classifier error
    }
  }

  return {
    step: 2, name: 'guardrails',
    status: 'pass',
    durationMs: 0,
    data: { checked_keywords: blocklist.length, checked_rules: outOfScope.length },
  }
}
