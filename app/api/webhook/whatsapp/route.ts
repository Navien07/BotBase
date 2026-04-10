import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import {
  verifyWebhook,
  verifySignature,
  handleInboundMessage,
  type WhatsAppWebhookPayload,
} from '@/lib/channels/whatsapp'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  try {
    const supabase = createServiceClient()
    const { data: configs } = await supabase
      .from('channel_configs')
      .select('bot_id, config')
      .eq('channel', 'whatsapp')
      .eq('is_active', true)

    for (const cfg of configs ?? []) {
      const storedToken = (cfg.config as Record<string, string>).verify_token
      const result = verifyWebhook(mode, token, challenge, storedToken)
      if (result) return new Response(result, { status: 200 })
    }

    return new Response('Forbidden', { status: 403 })
  } catch (error) {
    console.error('[webhook/whatsapp GET]', error)
    return new Response('Internal server error', { status: 500 })
  }
}

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed } = await rateLimit(`webhook:${ip}`, RATE_LIMITS.webhook)
  if (!allowed) return new Response('Rate limit exceeded', { status: 429 })

  // Get raw body for HMAC signature verification
  const rawBody = await req.text()
  const signature = req.headers.get('X-Hub-Signature-256')

  if (!signature) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // Find matching bot by verifying HMAC signature
    const supabase = createServiceClient()
    const { data: configs } = await supabase
      .from('channel_configs')
      .select('bot_id, config')
      .eq('channel', 'whatsapp')
      .eq('is_active', true)

    let matchedBotId: string | null = null
    for (const cfg of configs ?? []) {
      const appSecret = (cfg.config as Record<string, string>).app_secret
        ?? process.env.WEBHOOK_SECRET
        ?? ''
      if (appSecret && verifySignature(rawBody, signature, appSecret)) {
        matchedBotId = cfg.bot_id
        break
      }
    }

    if (!matchedBotId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload

    // Respond 200 immediately — WhatsApp requires < 5s response
    handleInboundMessage(payload, matchedBotId).catch((err: unknown) =>
      console.error('[webhook/whatsapp POST] handleInboundMessage:', err)
    )

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[webhook/whatsapp POST]', error)
    return new Response('Internal server error', { status: 500 })
  }
}
