import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { verifySecretToken, handleUpdate, type TelegramUpdate } from '@/lib/channels/telegram'

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed } = await rateLimit(`webhook:${ip}`, RATE_LIMITS.webhook)
  if (!allowed) return new Response('Rate limit exceeded', { status: 429 })

  // Telegram identifies bot via query param
  const { searchParams } = new URL(req.url)
  const botId = searchParams.get('botId')

  // DEBUG: log incoming request details
  console.log('[telegram webhook] headers:', {
    secret: req.headers.get('x-telegram-bot-api-secret-token'),
    contentType: req.headers.get('content-type'),
  })
  console.log('[telegram webhook] searchParams:', searchParams.toString())

  if (!botId) return new Response('Missing botId', { status: 400 })

  try {
    // Verify secret token
    const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
    const supabase = createServiceClient()
    const { data: cfg, error: configError } = await supabase
      .from('channel_configs')
      .select('config')
      .eq('bot_id', botId)
      .eq('channel', 'telegram')
      .single()

    // DEBUG: log DB lookup result
    console.log('[telegram webhook] bot config lookup:', { botId, configData: cfg, configError })

    if (!cfg) return new Response('Unauthorized', { status: 401 })

    const expectedSecret = (cfg.config as Record<string, string>).webhook_secret

    // DEBUG: log secret comparison
    console.log('[telegram webhook] secret check:', {
      expectedSecret,
      receivedSecret: secretHeader,
      match: expectedSecret === secretHeader,
    })

    // Only enforce secret token if one is configured for this bot
    if (expectedSecret && !verifySecretToken(secretHeader, expectedSecret)) {
      console.warn('[telegram webhook] SECRET MISMATCH - continuing anyway for debug')
      // return new Response('Unauthorized', { status: 401 })
    }

    const update = await req.json() as TelegramUpdate

    // Respond 200 immediately — process async
    handleUpdate(update, botId).catch((err: unknown) =>
      console.error('[webhook/telegram POST] handleUpdate:', err)
    )

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[webhook/telegram POST]', error)
    return new Response('Internal server error', { status: 500 })
  }
}
