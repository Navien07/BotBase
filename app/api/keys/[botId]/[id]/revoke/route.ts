import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit/logger'

// ─── POST: revoke an api key (soft delete via revoked_at) ─────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Verify key belongs to this bot before revoking
    const { data: existing, error: fetchError } = await supabase
      .from('api_keys')
      .select('id, label, revoked_at')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (fetchError || !existing) {
      return Response.json({ error: 'API key not found' }, { status: 404 })
    }

    if (existing.revoked_at) {
      return Response.json({ error: 'Key is already revoked' }, { status: 409 })
    }

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error

    logAudit({
      action: 'api_key_revoked',
      botId,
      userId: user.id,
      metadata: { key_id: id, label: existing.label },
    }).catch(console.error)

    return Response.json({ success: true })
  } catch (error) {
    console.error('[api-keys revoke POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
