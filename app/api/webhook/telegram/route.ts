import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { verifySecretToken, handleUpdate, type TelegramUpdate } from '@/lib/channels/telegram'
import { decrypt } from '@/lib/crypto/tokens'
import { after } from 'next/server'

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed } = await rateLimit(`webhook:${ip}`, RATE_LIMITS.webhook)
  if (!allowed) return new Response('Rate limit exceeded', { status: 429 })

  // Telegram identifies bot via query param
  const { searchParams } = new URL(req.url)
  const botId = searchParams.get('botId')
  if (!botId) return new Response('Missing botId', { status: 400 })

  try {
    const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
    const supabase = createServiceClient()
    const { data: cfg } = await supabase
      .from('channel_configs')
      .select('config')
      .eq('bot_id', botId)
      .eq('channel', 'telegram')
      .single()

    if (!cfg) return new Response('Unauthorized', { status: 401 })

    const encryptedSecret = (cfg.config as Record<string, string>).webhook_secret
    // webhook_secret is stored encrypted — decrypt before comparing
    const expectedSecret = encryptedSecret ? await decrypt(encryptedSecret) : null

    if (expectedSecret && !verifySecretToken(secretHeader, expectedSecret)) {
      return new Response('Unauthorized', { status: 401 })
    }

    const update = await req.json() as TelegramUpdate

    // after() keeps the function alive after returning 200
    // so the pipeline can complete without being killed by Vercel
    after(async () => {
      await handleUpdate(update, botId).catch((err: unknown) =>
        console.error('[webhook/telegram POST] handleUpdate:', err)
      )
    })

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[webhook/telegram POST]', error)
    return new Response('Internal server error', { status: 500 })
  }
}
