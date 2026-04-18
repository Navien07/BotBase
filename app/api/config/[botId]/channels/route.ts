import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, maskToken } from '@/lib/crypto/tokens'
import { nanoid } from 'nanoid'
import { setupWebhook } from '@/lib/channels/telegram'

// ─── GET: return masked channel configs ───────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()
    const { data: configs, error } = await serviceClient
      .from('channel_configs')
      .select('id, channel, is_active, config, created_at, updated_at')
      .eq('bot_id', botId)

    if (error) throw error

    // Mask all sensitive fields — never return raw tokens
    const masked = (configs ?? []).map((cfg) => {
      const config = cfg.config as Record<string, string>
      const safeConfig: Record<string, string> = {}

      for (const [key, value] of Object.entries(config)) {
        if (['access_token', 'bot_token', 'webhook_secret', 'app_secret'].includes(key)) {
          safeConfig[key] = value ? maskToken(value) : ''
        } else {
          safeConfig[key] = value
        }
      }

      return { ...cfg, config: safeConfig }
    })

    return Response.json({ configs: masked })
  } catch (error) {
    console.error('[config/channels GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const WhatsAppConfigSchema = z.object({
  channel: z.literal('whatsapp'),
  phone_number_id: z.string().min(1),
  access_token: z.string().min(1),
  verify_token: z.string().min(1).optional(),
  waba_id: z.string().optional(),
  app_secret: z.string().optional(),
})

const TelegramConfigSchema = z.object({
  channel: z.literal('telegram'),
  bot_token: z.string().min(10),
})

const ChannelConfigSchema = z.discriminatedUnion('channel', [
  WhatsAppConfigSchema,
  TelegramConfigSchema,
])

// ─── POST: upsert channel config ──────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = ChannelConfigSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const serviceClient = createServiceClient()

    if (data.channel === 'whatsapp') {
      // Auto-generate verify_token if not provided
      const verifyToken = data.verify_token ?? nanoid(24)

      // Test connection via WhatsApp API
      const testRes = await fetch(
        `https://graph.facebook.com/v19.0/${data.phone_number_id}`,
        { headers: { Authorization: `Bearer ${data.access_token}` } }
      )
      if (!testRes.ok) {
        return Response.json({ error: 'WhatsApp connection test failed. Check your Phone Number ID and Access Token.' }, { status: 400 })
      }

      const encryptedToken = await encrypt(data.access_token)
      const encryptedSecret = data.app_secret ? await encrypt(data.app_secret) : undefined

      const config: Record<string, string> = {
        phone_number_id: data.phone_number_id,
        access_token: encryptedToken,
        verify_token: verifyToken,
        waba_id: data.waba_id ?? '',
      }
      if (encryptedSecret) config.app_secret = encryptedSecret

      const { error } = await serviceClient
        .from('channel_configs')
        .upsert({
          bot_id: botId,
          channel: 'whatsapp',
          is_active: true,
          config,
        }, { onConflict: 'bot_id,channel' })

      if (error) throw error

      return Response.json({
        success: true,
        verify_token: verifyToken,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'}/api/webhook/whatsapp`,
      })
    }

    if (data.channel === 'telegram') {
      // Validate token via Telegram API
      const res = await fetch(`https://api.telegram.org/bot${data.bot_token}/getMe`)
      if (!res.ok) {
        return Response.json({ error: 'Invalid Telegram bot token' }, { status: 400 })
      }
      const tgData = await res.json() as { ok: boolean; result: { username: string } }
      if (!tgData.ok) {
        return Response.json({ error: 'Invalid Telegram bot token' }, { status: 400 })
      }

      // Generate webhook secret + auto-register before encrypting token
      const webhookSecret = nanoid(32)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'
      const webhookUrl = `${appUrl}/api/webhook/telegram?botId=${botId}`
      const webhookOk = await setupWebhook(data.bot_token, webhookUrl, webhookSecret)

      const encryptedToken = await encrypt(data.bot_token)
      const encryptedWebhookSecret = await encrypt(webhookSecret)

      const { error } = await serviceClient
        .from('channel_configs')
        .upsert({
          bot_id: botId,
          channel: 'telegram',
          is_active: true,
          config: {
            bot_token: encryptedToken,
            bot_username: tgData.result.username,
            webhook_url: webhookUrl,
            webhook_secret: encryptedWebhookSecret,
          },
        }, { onConflict: 'bot_id,channel' })

      if (error) throw error

      return Response.json({
        success: true,
        bot_username: tgData.result.username,
        webhook_registered: webhookOk,
        webhook_url: webhookUrl,
      })
    }

    return Response.json({ error: 'Unknown channel' }, { status: 400 })
  } catch (error) {
    console.error('[config/channels POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
