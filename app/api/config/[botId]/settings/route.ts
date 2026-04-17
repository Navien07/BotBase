import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Validation schema ─────────────────────────────────────────────────────────

const SettingsSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  timezone: z.string().min(1),
  default_language: z.enum(['en', 'bm', 'zh']),
  is_active: z.boolean().optional(),
  feature_flags: z.object({
    booking_enabled: z.boolean(),
    booking_type: z.enum(['appointment', 'table', 'property_viewing']),
    crm_enabled: z.boolean(),
    broadcasts_enabled: z.boolean(),
    flow_builder_enabled: z.boolean(),
    pdf_delivery_enabled: z.boolean(),
    widget_enabled: z.boolean(),
    voice_enabled: z.boolean(),
  }),
})

// ─── GET: bot settings ─────────────────────────────────────────────────────────

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

    // Verify bot belongs to the current user's tenant before returning any data.
    // google_connected_email is PII — only returned because the user has
    // authenticated access to this bot.
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await serviceClient
      .from('bots')
      .select('id, name, slug, timezone, default_language, feature_flags, is_active, google_refresh_token, google_connected_email, created_at')
      .eq('id', botId)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (error) throw error
    if (!data) return Response.json({ error: 'Bot not found' }, { status: 404 })

    // google_refresh_token is never sent to client — converted to boolean only.
    // google_connected_email passes through in ...rest (PII, access-controlled above).
    const { google_refresh_token, ...rest } = data
    return Response.json({ settings: { ...rest, has_google_connected: !!google_refresh_token } })
  } catch (error) {
    console.error('[settings GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PUT: update bot settings ──────────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = SettingsSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id)
      return Response.json({ error: 'Unauthorized' }, { status: 403 })

    const { error } = await serviceClient
      .from('bots')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', botId)
      .eq('tenant_id', profile.tenant_id)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[settings PUT]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── DELETE: delete bot ────────────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id)
      return Response.json({ error: 'Unauthorized' }, { status: 403 })

    const { data: ownedBot } = await serviceClient
      .from('bots').select('id').eq('id', botId).eq('tenant_id', profile.tenant_id).single()
    if (!ownedBot)
      return Response.json({ error: 'Bot not found' }, { status: 404 })

    const { error } = await serviceClient
      .from('bots')
      .delete()
      .eq('id', botId)
      .eq('tenant_id', profile.tenant_id)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[settings DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
