import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { runPipeline } from '@/lib/pipeline'
import type { PipelineContext } from '@/lib/pipeline'
import type { Bot } from '@/types/database'

// Allow up to 30s for streaming responses (P-22)
export const maxDuration = 30

// ─── Validation ───────────────────────────────────────────────────────────────

const TestingChatSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid(),
})

// ─── POST: session-authenticated testing chat ─────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  // Session auth — dashboard users only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit by user ID
  const rateLimitResult = await rateLimit(user.id, RATE_LIMITS.dashboard)
  if (!rateLimitResult.allowed) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = TestingChatSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { message, sessionId } = parsed.data
    const service = createServiceClient()

    // Fetch bot config — verify it exists
    const { data: bot, error: botError } = await service
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single()

    if (botError || !bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Get or create a testing conversation keyed by sessionId
    let conversationId: string

    const { data: existing } = await service
      .from('conversations')
      .select('id')
      .eq('bot_id', botId)
      .eq('external_user_id', sessionId)
      .eq('channel', 'testing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      conversationId = existing.id
    } else {
      const { data: newConv, error: convError } = await service
        .from('conversations')
        .insert({
          bot_id: botId,
          external_user_id: sessionId,
          channel: 'testing',
          language: bot.default_language ?? 'en',
          metadata: { testing_user_id: user.id },
        })
        .select('id')
        .single()

      if (convError || !newConv) throw new Error('Failed to create testing conversation')
      conversationId = newConv.id
    }

    // Build pipeline context
    const pipelineContext: PipelineContext = {
      botId,
      conversationId,
      contactId: null,
      message,
      userId: sessionId,
      channel: 'testing',
      bot: bot as Bot,
      language: bot.default_language ?? 'en',
      startedAt: Date.now(),
      history: [],
      detectedIntent: null,
      detectedLanguage: null,
      messageEmbedding: null,
      faqResult: null,
      ragChunks: [],
      liveApiData: null,
      bookingState: null,
      activeScriptId: null,
      systemPrompt: null,
    }

    const { stream, result } = await runPipeline(pipelineContext)

    // Encode compact step metadata as base64 so the client can populate the
    // pipeline panel immediately — no DB round-trip needed.
    // (data field omitted to keep header size small; DB fetch adds it later)
    const stepsCompact = (result.steps ?? []).map((s) => ({
      step: s.step,
      name: s.name,
      status: s.status,
      durationMs: s.durationMs,
      data: {} as Record<string, unknown>,
      ...(s.blockedResponse ? { blockedResponse: s.blockedResponse } : {}),
    }))
    const stepsB64 = Buffer.from(JSON.stringify(stepsCompact)).toString('base64')

    const responseHeaders = new Headers({
      'X-Conversation-Id': conversationId,
      'X-Session-Id': sessionId,
      'X-Intent': result.intent ?? '',
      'X-Language': result.language,
      'X-Rag-Found': result.ragFound ? 'true' : 'false',
      'X-Pipeline-Steps': stepsB64,
      'X-Total-Duration': String(result.totalDurationMs ?? 0),
    })

    if (stream) {
      responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
      responseHeaders.set('Transfer-Encoding', 'chunked')
      responseHeaders.set('X-Accel-Buffering', 'no')
      return new Response(stream, { headers: responseHeaders })
    }

    // Non-streaming (guardrail block / booking state machine)
    responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
    responseHeaders.set('X-Guardrail-Triggered', result.guardrailTriggered ? 'true' : 'false')
    responseHeaders.set('X-Booking-Active', result.bookingActive ? 'true' : 'false')
    return new Response(result.response ?? '', { headers: responseHeaders })
  } catch (error) {
    console.error('[testing/chat POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
