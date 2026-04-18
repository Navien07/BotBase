import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { runPipeline } from '@/lib/pipeline'
import { upsertContact } from '@/lib/crm/contacts'
import type { PipelineContext } from '@/lib/pipeline'
import type { Bot, Channel } from '@/types/database'

export const maxDuration = 60

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const ALLOWED_DEV_ORIGINS = ['localhost', '127.0.0.1', 'app.icebot.ai']

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const WidgetChatSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(1).max(128),
  userId: z.string().max(255).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400, headers: CORS_HEADERS })
  }

  // Rate limit by session via Origin header or IP
  const origin = req.headers.get('origin') ?? ''
  const identifier = `widget:${botId}:${origin || 'unknown'}`
  const rateLimitResult = await rateLimit(identifier, RATE_LIMITS.widget)
  if (!rateLimitResult.allowed) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS_HEADERS })
  }

  try {
    const supabase = createServiceClient()

    // Domain check — allowed_domains or dev origins
    const { data: widgetConfig } = await supabase
      .from('widget_configs')
      .select('allowed_domains')
      .eq('bot_id', botId)
      .single()

    const allowedDomains: string[] = widgetConfig?.allowed_domains ?? []

    if (origin) {
      let originHost: string
      try {
        originHost = new URL(origin).hostname
      } catch {
        originHost = origin
      }
      const isDev = ALLOWED_DEV_ORIGINS.some(d => originHost === d || originHost.endsWith('.' + d))
      const isAllowed = isDev || allowedDomains.length === 0 || allowedDomains.some(d => originHost === d || originHost.endsWith('.' + d))
      if (!isAllowed) {
        return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: CORS_HEADERS })
      }
    }

    // Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS })
    }

    const parsed = WidgetChatSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400, headers: CORS_HEADERS })
    }

    const { message, sessionId, userId } = parsed.data
    const externalUserId = userId ?? `widget:${sessionId}`

    // Fetch bot
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single()

    if (botError || !bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404, headers: CORS_HEADERS })
    }

    if (!bot.is_active) {
      return Response.json({ error: 'Bot is inactive' }, { status: 403, headers: CORS_HEADERS })
    }

    // Get or create conversation keyed by sessionId
    let resolvedConversationId: string

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('bot_id', botId)
      .eq('external_user_id', externalUserId)
      .eq('channel', 'web_widget')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      resolvedConversationId = existing.id
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          bot_id: botId,
          external_user_id: externalUserId,
          channel: 'web_widget',
          language: bot.default_language ?? 'en',
          metadata: { session_id: sessionId },
        })
        .select('id')
        .single()

      if (convError || !newConv) throw new Error('Failed to create conversation')
      resolvedConversationId = newConv.id
    }

    // Upsert contact (fire-and-forget)
    let contactId: string | null = null
    const contactPromise = upsertContact({
      botId,
      externalId: externalUserId,
      channel: 'web_widget' as Channel,
      language: bot.default_language ?? 'en',
    }).then(c => { if (c) contactId = c.id }).catch(() => null)

    const pipelineContext: PipelineContext = {
      botId,
      conversationId: resolvedConversationId,
      contactId,
      message,
      userId: externalUserId,
      channel: 'web_widget',
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

    await contactPromise.catch(() => null)

    const responseHeaders = new Headers({
      ...CORS_HEADERS,
      'X-Conversation-Id': resolvedConversationId,
      'X-Intent': result.intent ?? '',
      'X-Language': result.language,
      'X-Rag-Found': result.ragFound ? 'true' : 'false',
    })

    if (stream) {
      responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
      responseHeaders.set('Transfer-Encoding', 'chunked')
      responseHeaders.set('X-Accel-Buffering', 'no')
      return new Response(stream, { headers: responseHeaders })
    }

    responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
    return new Response(result.response ?? '', { headers: responseHeaders })
  } catch (error) {
    console.error('[widget/chat POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
