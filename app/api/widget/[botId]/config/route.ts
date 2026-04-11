import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// GET — public, no auth
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400, headers: CORS_HEADERS })
  }

  try {
    const supabase = createServiceClient()

    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('name, avatar_url, is_active')
      .eq('id', botId)
      .single()

    if (botError || !bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404, headers: CORS_HEADERS })
    }

    if (!bot.is_active) {
      return Response.json({ error: 'Bot is inactive' }, { status: 403, headers: CORS_HEADERS })
    }

    const { data: config } = await supabase
      .from('widget_configs')
      .select(
        'primary_color, secondary_color, font_family, bubble_style, position, welcome_message, quick_replies, show_branding'
      )
      .eq('bot_id', botId)
      .single()

    return Response.json(
      {
        botName: bot.name,
        avatarUrl: bot.avatar_url ?? null,
        primaryColor: config?.primary_color ?? '#6366f1',
        secondaryColor: config?.secondary_color ?? '#f1f5f9',
        fontFamily: config?.font_family ?? 'Inter',
        bubbleStyle: config?.bubble_style ?? 'rounded',
        position: config?.position ?? 'bottom-right',
        welcomeMessage: config?.welcome_message ?? null,
        quickReplies: config?.quick_replies ?? [],
        showBranding: config?.show_branding ?? true,
      },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error('[widget/config GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

// PATCH — dashboard auth required
const PatchSchema = z.object({
  primary_color: z.string().max(20).optional(),
  secondary_color: z.string().max(20).optional(),
  font_family: z.string().max(100).optional(),
  bubble_style: z.enum(['rounded', 'square']).optional(),
  position: z.enum(['bottom-right', 'bottom-left']).optional(),
  welcome_message: z.string().max(500).nullable().optional(),
  quick_replies: z.array(z.string().max(100)).max(10).optional(),
  show_branding: z.boolean().optional(),
  allowed_domains: z.array(z.string().max(253)).max(50).optional(),
  custom_css: z.string().max(10000).nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Verify user owns this bot
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .single()

    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { error } = await supabase
      .from('widget_configs')
      .upsert({ bot_id: botId, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'bot_id' })

    if (error) throw error

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[widget/config PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
