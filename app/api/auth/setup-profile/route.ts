import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = user.user_metadata
  const tenantId = meta?.tenant_id as string | undefined
  const role = (meta?.role as string | undefined) ?? 'tenant_admin'

  if (!tenantId) return Response.json({ skipped: true })

  try {
    const serviceClient = createServiceClient()
    await serviceClient.from('profiles').upsert({
      id: user.id,
      tenant_id: tenantId,
      role,
      full_name: (meta?.full_name as string | undefined) ?? user.email ?? '',
    }, { onConflict: 'id' })

    return Response.json({ success: true })
  } catch (error) {
    console.error('[auth/setup-profile POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
