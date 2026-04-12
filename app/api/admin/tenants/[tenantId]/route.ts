import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

// ─── DELETE — permanently erase tenant, bots, all data, all users ─────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  if (!tenantId) return Response.json({ error: 'Missing tenantId' }, { status: 400 })

  // Verify super_admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: callerProfile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // 1. Get tenant name + all bot IDs
    const { data: tenantRow } = await serviceClient
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()
    const tenantName = tenantRow?.name ?? tenantId

    const { data: bots } = await serviceClient
      .from('bots')
      .select('id')
      .eq('tenant_id', tenantId)

    const botIds = (bots ?? []).map((b) => b.id)

    // 2. Collect document file paths for storage cleanup
    if (botIds.length > 0) {
      const { data: docs } = await serviceClient
        .from('documents')
        .select('file_path')
        .in('bot_id', botIds)

      const filePaths = (docs ?? []).map((d) => d.file_path).filter(Boolean)
      if (filePaths.length > 0) {
        // Best-effort — don't fail the whole operation if storage delete errors
        await serviceClient.storage.from('bot-files').remove(filePaths).catch((e) => {
          console.error('[tenant DELETE] storage cleanup error', e)
        })
      }

      // 3. Delete agent_sessions — no ON DELETE CASCADE from bots, must be manual
      await serviceClient
        .from('agent_sessions')
        .delete()
        .in('bot_id', botIds)
    }

    // 4. Get all auth user IDs + emails for this tenant (from profiles)
    const { data: tenantProfiles } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)

    const userIds = (tenantProfiles ?? []).map((p) => p.id)

    // 5. Collect emails + delete each auth user — cascades: profiles, agent_profiles
    const deletedEmails: string[] = []
    for (const userId of userIds) {
      const { data: authUser } = await serviceClient.auth.admin.getUserById(userId)
      if (authUser?.user?.email) deletedEmails.push(authUser.user.email)

      const { error } = await serviceClient.auth.admin.deleteUser(userId)
      if (error) {
        console.error(`[tenant DELETE] failed to delete auth user ${userId}:`, error)
      }
    }

    // 6. Delete the tenant — cascades: tenant_invites, onboarding_progress, bots
    //    bots cascade: documents, chunks, faqs, products, conversations→messages,
    //    contacts→bookings, channel_configs, api_keys, response_templates,
    //    bot_scripts→versions, broadcast_campaigns→recipients, drip_sequences,
    //    agent_profiles, followup_rules→queue, widget_configs, facilities_config
    const { error: tenantDeleteError } = await serviceClient
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (tenantDeleteError) throw tenantDeleteError

    return Response.json({
      success: true,
      deleted: {
        tenant: tenantName,
        bots: botIds.length,
        users: deletedEmails,
      },
    })
  } catch (error) {
    console.error('[admin/tenants/[tenantId] DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

const patchSchema = z.object({
  is_active: z.boolean(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  if (!tenantId) return Response.json({ error: 'Missing tenantId' }, { status: 400 })

  // Super admin check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { is_active } = parsed.data

  try {
    const serviceClient = createServiceClient()

    // Update tenant is_active
    const { data: tenant, error: tenantError } = await serviceClient
      .from('tenants')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select()
      .single()

    if (tenantError) throw tenantError

    // When suspending, also deactivate all bots for this tenant
    if (!is_active) {
      const { error: botsError } = await serviceClient
        .from('bots')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)

      if (botsError) throw botsError
    }

    return Response.json({ tenant })
  } catch (error) {
    console.error('[admin/tenants/[tenantId] PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
