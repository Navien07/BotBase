import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto/tokens'
import { setupWebhook, getMe } from '@/lib/channels/telegram'
import { nanoid } from 'nanoid'

const SetupSchema = z.object({
  botId: z.string().uuid(),
  botToken: z.string().min(10),
})

export async function POST(req: Request) {
  // Auth check — dashboard only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = SetupSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { botId, botToken } = parsed.data

    // Verify the token is valid by calling getMe
    const botInfo = await getMe(botToken)
    if (!botInfo) {
      return Response.json({ error: 'Invalid Telegram bot token' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'
    const webhookUrl = `${appUrl}/api/webhook/telegram?botId=${botId}`
    const webhookSecret = nanoid(32)

    // Register webhook with Telegram
    const ok = await setupWebhook(botToken, webhookUrl, webhookSecret)
    if (!ok) {
      return Response.json({ error: 'Failed to register webhook with Telegram' }, { status: 502 })
    }

    // Encrypt token and store config
    const encryptedToken = await encrypt(botToken)
    const encryptedSecret = await encrypt(webhookSecret)

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('channel_configs')
      .upsert({
        bot_id: botId,
        channel: 'telegram',
        is_active: true,
        config: {
          bot_token: encryptedToken,
          bot_username: botInfo.username,
          webhook_url: webhookUrl,
          webhook_secret: encryptedSecret,
        },
      }, { onConflict: 'bot_id,channel' })

    if (error) {
      console.error('[webhook/telegram/setup POST]', error)
      return Response.json({ error: 'Failed to save config' }, { status: 500 })
    }

    return Response.json({
      success: true,
      botUsername: botInfo.username,
      webhookUrl,
    })
  } catch (error) {
    console.error('[webhook/telegram/setup POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
