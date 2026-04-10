import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { analyzeSentiment } from '@/lib/sentiment/analyzer'
import type { PipelineContext, StepResult } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface Step10Result {
  stream: ReadableStream<Uint8Array>
  stepResult: StepResult
}

export async function step10Llm(
  ctx: PipelineContext,
  priorSteps: StepResult[]
): Promise<Step10Result> {
  const model = 'claude-haiku-4-5-20251001'
  const maxTokens = Math.min(ctx.bot.response_max_words * 5, 2048)

  const messages: Anthropic.MessageParam[] = [
    ...ctx.history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: ctx.message },
  ]

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const startTime = Date.now()

  // Start streaming in background
  ;(async () => {
    let fullResponse = ''
    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: maxTokens,
        system: ctx.systemPrompt ?? 'You are a helpful AI assistant.',
        messages,
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text
          fullResponse += text
          await writer.write(encoder.encode(text))
        }
      }
    } catch (err) {
      console.error('[step-10-llm] stream error:', err)
      if (!fullResponse) {
        await writer.write(encoder.encode(ctx.bot.fallback_message ?? 'Sorry, I encountered an error. Please try again.'))
      }
    } finally {
      await writer.close()
      const latencyMs = Date.now() - startTime

      // Fire-and-forget: log messages + sentiment to DB
      logConversation(ctx, fullResponse, latencyMs, priorSteps).catch((e) =>
        console.error('[step-10-llm] logConversation error:', e)
      )
    }
  })()

  return {
    stream: readable,
    stepResult: {
      step: 10, name: 'llm',
      status: 'pass',
      durationMs: 0,
      data: { model, max_tokens: maxTokens },
    },
  }
}

async function logConversation(
  ctx: PipelineContext,
  assistantResponse: string,
  latencyMs: number,
  steps: StepResult[]
): Promise<void> {
  const supabase = createServiceClient()

  const pipelineDebug = {
    steps: steps.map((s) => ({
      step: s.step,
      name: s.name,
      status: s.status,
      duration_ms: s.durationMs,
      data: s.data,
    })),
    intent: ctx.detectedIntent,
    language: ctx.detectedLanguage,
    rag_found: ctx.ragChunks.length > 0,
    booking_active: !!ctx.bookingState,
    total_ms: Date.now() - ctx.startedAt,
  }

  // Sentiment analysis (fire-and-forget itself)
  const sentimentPromise = analyzeSentiment(ctx.message)

  // Log user message
  await supabase.from('messages').insert({
    conversation_id: ctx.conversationId,
    bot_id: ctx.botId,
    role: 'user',
    content: ctx.message,
    intent: ctx.detectedIntent,
    language: ctx.detectedLanguage,
    rag_found: false,
    source_chunks: [],
    pipeline_debug: {},
  })

  // Resolve sentiment
  const sentiment = await sentimentPromise.catch(() => ({ sentiment: 'neutral' as const, score: 0.5 }))

  // Log assistant message with pipeline debug
  await supabase.from('messages').insert({
    conversation_id: ctx.conversationId,
    bot_id: ctx.botId,
    role: 'assistant',
    content: assistantResponse,
    intent: ctx.detectedIntent,
    language: ctx.detectedLanguage,
    rag_found: ctx.ragChunks.length > 0,
    source_chunks: ctx.ragChunks.map((c) => c.id),
    response_latency_ms: latencyMs,
    sentiment: sentiment.sentiment,
    sentiment_score: sentiment.score,
    pipeline_debug: pipelineDebug,
  })

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', ctx.conversationId)
}
