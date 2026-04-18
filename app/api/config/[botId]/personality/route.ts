import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'

// ─── GET: return personality fields ───────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  try {
    const { data, error } = await createServiceClient()
      .from('bots')
      .select(
        'bot_name, system_prompt, personality_preset, ' +
        'tone_formal, tone_verbose, tone_emoji, tone_lock_language, ' +
        'greeting_en, greeting_bm, greeting_zh, ' +
        'default_language, timezone, avatar_url'
      )
      .eq('id', botId)
      .single()

    if (error) throw error
    if (!data) return Response.json({ error: 'Bot not found' }, { status: 404 })

    return Response.json({ personality: data })
  } catch (error) {
    console.error('[personality GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── Validation schema ─────────────────────────────────────────────────────────

const PersonalitySchema = z.object({
  bot_name: z.string().min(1).max(100),
  system_prompt: z.string().max(8000).nullable().optional(),
  personality_preset: z.enum(['professional', 'friendly', 'concise', 'custom']),
  tone_formal: z.boolean(),
  tone_verbose: z.boolean(),
  tone_emoji: z.boolean(),
  tone_lock_language: z.boolean(),
  greeting_en: z.string().max(500).nullable().optional(),
  greeting_bm: z.string().max(500).nullable().optional(),
  greeting_zh: z.string().max(500).nullable().optional(),
  default_language: z.enum(['en', 'bm', 'zh']),
  timezone: z.string().min(1),
  avatar_url: z.string().url().nullable().optional(),
})

// ─── PUT: update personality fields ───────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  try {
    const body = await req.json()
    const parsed = PersonalitySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('bots')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', botId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[personality PUT]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
