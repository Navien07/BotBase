import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'

// ─── PATCH: partial update of bot fields ──────────────────────────────────────

const PatchSchema = z.object({
  is_active: z.boolean().optional(),
  system_prompt: z.string().max(4000).optional(),
  greeting_en: z.string().max(500).optional(),
  greeting_bm: z.string().max(500).optional(),
  keyword_blocklist: z.array(z.string()).optional(),
  fallback_message: z.string().max(500).optional(),
  name: z.string().min(1).max(100).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const serviceClient = createServiceClient()

    const { data: bot, error } = await serviceClient
      .from('bots')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', botId)
      .select('id, name, is_active, updated_at')
      .single()

    if (error) throw error
    if (!bot) return Response.json({ error: 'Bot not found' }, { status: 404 })

    return Response.json({ bot })
  } catch (error) {
    console.error('[bots/[botId] PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
