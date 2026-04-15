import { createHash } from 'crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { runPipeline } from '@/lib/pipeline'
import { upsertContact } from '@/lib/crm/contacts'
import { refreshLeadStageAndScore } from '@/lib/crm/lead-score'
import { isTenantBot } from '@/lib/tenants'
import { dispatchBrochure } from '@/lib/tenants/elken/booking/notifications'
import type { PipelineContext } from '@/lib/pipeline'
import type { Bot, Channel } from '@/types/database'

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  externalUserId: z.string().min(1).max(255),
  channel: z.enum(['whatsapp', 'telegram', 'web_widget', 'instagram', 'facebook', 'api']).default('api'),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(50).optional(),
  contactEmail: z.string().email().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.get('authorization') ?? ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!apiKey) {
    return Response.json({ error: 'Missing API key' }, { status: 401 })
  }

  // Hash the key for lookup
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const supabase = createServiceClient()

  // Rate limit by API key hash
  const rateLimitResult = await rateLimit(keyHash, RATE_LIMITS.chat)
  if (!rateLimitResult.allowed) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  try {
    // Validate API key → get bot
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from('api_keys')
      .select('bot_id, allowed_origins')
      .eq('key_hash', keyHash)
      .eq('bot_id', botId)
      .is('revoked_at', null)
      .single()

    if (keyError || !apiKeyRecord) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Check origin if allowed_origins is set
    const origin = req.headers.get('origin') ?? ''
    const allowedOrigins = apiKeyRecord.allowed_origins as string[]
    if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin) && !allowedOrigins.includes('*')) {
      return Response.json({ error: 'Origin not allowed' }, { status: 403 })
    }

    // Parse + validate request body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { message, conversationId, externalUserId, channel, contactName, contactPhone, contactEmail } = parsed.data

    // Fetch bot config
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single()

    if (botError || !bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (!bot.is_active) {
      return Response.json({ error: 'Bot is inactive' }, { status: 403 })
    }

    // Get or create conversation
    let resolvedConversationId = conversationId
    if (!resolvedConversationId) {
      // Check for existing conversation with this external user
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('bot_id', botId)
        .eq('external_user_id', externalUserId)
        .eq('channel', channel)
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
            channel,
            language: bot.default_language ?? 'en',
            metadata: {},
          })
          .select('id')
          .single()

        if (convError || !newConv) {
          throw new Error('Failed to create conversation')
        }
        resolvedConversationId = newConv.id
      }
    }

    // Update API key last_used_at (fire-and-forget)
    void supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash)
      .then(() => null, () => null)

    // Upsert contact async (fire-and-forget)
    let contactId: string | null = null
    const contactPromise = upsertContact({
      botId,
      externalId: externalUserId,
      channel: channel as Channel,
      name: contactName,
      phone: contactPhone,
      email: contactEmail,
      language: bot.default_language ?? 'en',
    }).then((c) => { if (c) contactId = c.id }).catch(() => null)

    if (!resolvedConversationId) {
      throw new Error('Failed to resolve conversationId')
    }

    // Stop bot if conversation is assigned to a human agent
    const { data: convCheck } = await supabase
      .from('conversations')
      .select('agent_id')
      .eq('id', resolvedConversationId)
      .single()
    if (convCheck?.agent_id) {
      return Response.json({ message: 'Conversation assigned to agent' }, { status: 200 })
    }

    // Build pipeline context
    const pipelineContext: PipelineContext = {
      botId,
      conversationId: resolvedConversationId,
      contactId,
      message,
      userId: externalUserId,
      channel,
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

    // Run pipeline
    const { stream, result } = await runPipeline(pipelineContext)

    // Elken: fire-and-forget brochure dispatch for product/health intents
    if (
      isTenantBot(botId) &&
      (result.intent === 'browse_product' || result.intent === 'health_issue') &&
      pipelineContext.ragChunks.length > 0
    ) {
      const topChunk = pipelineContext.ragChunks[0]
      void (async () => {
        try {
          const { data: doc } = await supabase
            .from('documents')
            .select('metadata')
            .eq('id', topChunk.documentId)
            .single()
          const productName = (doc?.metadata as Record<string, string> | null)?.product_name
          if (productName) {
            await dispatchBrochure(botId, externalUserId, channel, productName, result.language)
          }
        } catch (err) {
          console.error('[Brochure] Dispatch failed:', err)
        }
      })()
    }

    // Allow contact upsert to settle, then link contact_id to conversation
    await contactPromise.catch(() => null)
    if (contactId) {
      void supabase
        .from('conversations')
        .update({ contact_id: contactId })
        .eq('id', resolvedConversationId)
        .is('contact_id', null) // only update if not already set
        .then(() => null, () => null)

      // Refresh lead score + auto-classify stage (fire-and-forget)
      refreshLeadStageAndScore(contactId).catch(() => null)
    }

    const responseHeaders = new Headers({
      'X-Conversation-Id': resolvedConversationId,
      'X-Intent': result.intent ?? '',
      'X-Language': result.language,
      'X-Rag-Found': result.ragFound ? 'true' : 'false',
    })

    // Streaming response
    if (stream) {
      responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
      responseHeaders.set('Transfer-Encoding', 'chunked')
      responseHeaders.set('X-Accel-Buffering', 'no')
      return new Response(stream, { headers: responseHeaders })
    }

    // Blocked response (guardrail / booking / script)
    responseHeaders.set('Content-Type', 'text/plain; charset=utf-8')
    responseHeaders.set('X-Guardrail-Triggered', result.guardrailTriggered ? 'true' : 'false')
    responseHeaders.set('X-Booking-Active', result.bookingActive ? 'true' : 'false')
    return new Response(result.response ?? '', { headers: responseHeaders })
  } catch (error) {
    console.error('[chat/[botId] POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
