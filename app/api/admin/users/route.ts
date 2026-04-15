import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['super_admin', 'tenant_admin', 'agent']).optional(),
  tenantId: z.string().uuid().nullable().optional(),
})

export async function GET() {
  // Super admin check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {

    // Get all profiles joined with tenant names
    const { data: profiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id, display_name, role, tenant_id, created_at, tenants(name)')
      .order('created_at', { ascending: false })

    if (profilesError) throw profilesError

    // Get auth user emails via admin API
    const { data: usersData, error: usersError } = await serviceClient.auth.admin.listUsers({
      perPage: 1000,
    })

    if (usersError) throw usersError

    const emailMap: Record<string, string> = {}
    for (const u of usersData.users) {
      emailMap[u.id] = u.email ?? ''
    }

    const result = (profiles ?? []).map((p) => {
      const tenantRaw = p.tenants as unknown
      const tenantRow = Array.isArray(tenantRaw)
        ? (tenantRaw[0] as { name: string } | undefined) ?? null
        : (tenantRaw as { name: string } | null)
      return {
        id: p.id,
        display_name: p.display_name,
        role: p.role,
        tenant_id: p.tenant_id,
        tenant_name: tenantRow?.name ?? null,
        email: emailMap[p.id] ?? '',
        created_at: p.created_at,
      }
    })

    return Response.json({ users: result })
  } catch (error) {
    console.error('[admin/users GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  // Super admin check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
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

  const { userId, role, tenantId } = parsed.data

  if (!role && tenantId === undefined) {
    return Response.json({ error: 'Provide at least one of: role, tenantId' }, { status: 400 })
  }

  try {

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (role !== undefined) updates.role = role
    if (tenantId !== undefined) updates.tenant_id = tenantId

    const { data: updated, error } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    return Response.json({ user: updated })
  } catch (error) {
    console.error('[admin/users PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
