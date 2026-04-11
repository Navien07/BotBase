import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  adminEmail: z.string().email(),
  industry: z.string().min(1).max(100).optional(),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function GET() {
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

  try {
    const serviceClient = createServiceClient()

    const { data: tenants, error } = await serviceClient
      .from('tenants')
      .select('id, name, slug, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get bot counts per tenant
    const { data: botCounts, error: botError } = await serviceClient
      .from('bots')
      .select('tenant_id')

    if (botError) throw botError

    const countMap: Record<string, number> = {}
    for (const bot of botCounts ?? []) {
      countMap[bot.tenant_id] = (countMap[bot.tenant_id] ?? 0) + 1
    }

    const result = (tenants ?? []).map((t) => ({
      ...t,
      bots_count: countMap[t.id] ?? 0,
    }))

    return Response.json({ tenants: result })
  } catch (error) {
    console.error('[admin/tenants GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
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

  const parsed = createTenantSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, adminEmail } = parsed.data

  try {
    const serviceClient = createServiceClient()

    // Generate unique slug
    const baseSlug = slugify(name)
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await serviceClient
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await serviceClient
      .from('tenants')
      .insert({ name, slug, is_active: true })
      .select()
      .single()

    if (tenantError) throw tenantError

    // Invite user via Supabase auth admin API
    const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      adminEmail,
      {
        data: {
          tenant_id: tenant.id,
          role: 'tenant_admin',
        },
      }
    )

    if (inviteError) throw inviteError

    return Response.json({ tenant, inviteSent: true }, { status: 201 })
  } catch (error) {
    console.error('[admin/tenants POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
