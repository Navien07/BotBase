import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { logAudit } from '@/lib/audit/logger'
import { DR_AIMAN_BOT_ID, TRIGGER_VALUES } from '@/lib/tenants/dr-aiman/media-triggers/config'

const PatchSchema = z.object({
  caption:       z.string().max(500).nullable().optional(),
  trigger_value: z.enum(TRIGGER_VALUES).optional(),
  display_order: z.number().int().min(0).optional(),
  is_active:     z.boolean().optional(),
})

// ─── PATCH — edit caption, trigger_value, display_order, or is_active ─────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  if (!botId || !id) return Response.json({ error: 'Missing params' }, { status: 400 })

  if (botId !== DR_AIMAN_BOT_ID) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(user.id, RATE_LIMITS.dashboard)
  if (!rl.allowed) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck
  const { tenantId } = accessCheck

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

    const { data: trigger, error } = await serviceClient
      .from('bot_media_triggers')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('bot_id', botId)  // P-01: always scope by bot_id, belt-and-braces over RLS
      .select('id, trigger_value, caption, display_order, is_active, updated_at')
      .single()

    if (error) throw error
    if (!trigger) return Response.json({ error: 'Not found' }, { status: 404 })

    logAudit({
      action: 'media_trigger_edited',
      botId,
      tenantId,
      userId: user.id,
      metadata: { trigger_id: id, changes: parsed.data },
    }).catch(console.error)

    return Response.json({ trigger })
  } catch (error) {
    console.error('[dr-aiman/media-triggers/[id] PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── DELETE — soft (default) or hard (?hard=true) ────────────────────────────
// Soft delete: sets is_active = false. Record and storage object are preserved.
//              Allows recovery from accidental deletion.
// Hard delete: removes storage object, then hard-deletes DB row.
//              If storage removal fails, logs a warning and proceeds with DB delete —
//              orphan files in storage are cosmetic; the DB row is source of truth.

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  if (!botId || !id) return Response.json({ error: 'Missing params' }, { status: 400 })

  if (botId !== DR_AIMAN_BOT_ID) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(user.id, RATE_LIMITS.dashboard)
  if (!rl.allowed) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck
  const { tenantId } = accessCheck

  const { searchParams } = new URL(req.url)
  const hardDelete = searchParams.get('hard') === 'true'

  try {
    const serviceClient = createServiceClient()

    // Fetch record first — needed for storage_path on hard delete, and to confirm ownership
    const { data: trigger, error: fetchError } = await serviceClient
      .from('bot_media_triggers')
      .select('id, storage_path')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (fetchError || !trigger) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    if (hardDelete) {
      // Attempt storage removal first. On failure: log warning, proceed with DB delete.
      // Orphaned storage files are cosmetic — the DB row drives active trigger dispatch.
      const { error: storageError } = await serviceClient
        .storage
        .from('bot-files')
        .remove([trigger.storage_path])
      if (storageError) {
        console.warn('[dr-aiman/media-triggers/[id] DELETE] storage remove failed, proceeding:', storageError)
      }

      const { error: deleteError } = await serviceClient
        .from('bot_media_triggers')
        .delete()
        .eq('id', id)
        .eq('bot_id', botId)
      if (deleteError) throw deleteError
    } else {
      const { error: softError } = await serviceClient
        .from('bot_media_triggers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('bot_id', botId)
      if (softError) throw softError
    }

    logAudit({
      action: 'media_trigger_deleted',
      botId,
      tenantId,
      userId: user.id,
      metadata: {
        trigger_id: id,
        hard: hardDelete,
        storage_path: trigger.storage_path,
      },
    }).catch(console.error)

    return Response.json({ success: true })
  } catch (error) {
    console.error('[dr-aiman/media-triggers/[id] DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
