// app/api/auth/google/disconnect/route.ts — Clear Google Calendar credentials from a bot

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/crypto/tokens'

const BodySchema = z.object({ botId: z.string().uuid() })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { botId } = parsed.data

    // Verify the bot exists and belongs to the current user's tenant
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: bot } = await serviceClient
      .from('bots')
      .select('id, google_access_token')
      .eq('id', botId)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Revoke the access token with Google before clearing our DB.
    // Best-effort — a revocation failure doesn't block the disconnect.
    if (bot.google_access_token) {
      try {
        const plainToken = await decrypt(bot.google_access_token)
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(plainToken)}`, {
          method: 'POST',
        })
      } catch (err) {
        console.error('[google/disconnect] token revocation failed (non-fatal):', err)
      }
    }

    // Clear all 6 Google Calendar fields
    const { error } = await serviceClient
      .from('bots')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_calendar_id: null,
        google_resource_calendars: null,
        google_connected_email: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', botId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[google/disconnect POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
