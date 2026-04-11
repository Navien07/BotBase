import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

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
