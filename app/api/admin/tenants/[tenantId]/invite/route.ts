import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  if (!tenantId) return Response.json({ error: 'Missing tenantId' }, { status: 400 })

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

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { email } = parsed.data

  try {
    // Verify tenant exists
    const { data: tenant, error: tenantError } = await serviceClient
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          tenant_id: tenantId,
          role: 'tenant_admin',
        },
      }
    )

    if (inviteError) throw inviteError

    // Upsert profile if Supabase returned the user object
    if (inviteData?.user?.id) {
      await serviceClient.from('profiles').upsert({
        id: inviteData.user.id,
        tenant_id: tenantId,
        role: 'tenant_admin',
        full_name: inviteData.user.email ?? email,
      }, { onConflict: 'id' })
    }

    return Response.json({ success: true, email })
  } catch (error) {
    console.error('[admin/tenants/[tenantId]/invite POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
