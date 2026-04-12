import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()

    // Get existing profile first — preserve any valid tenant_id already set by the invite flow.
    // Recovery links do NOT carry tenant_id in user_metadata, so we must never overwrite
    // an existing valid tenant_id with null from metadata.
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    const metaTenantId = (user.user_metadata?.tenant_id as string | undefined) ?? null
    const metaRole = (user.user_metadata?.role as string | undefined) ?? 'tenant_admin'

    const tenant_id = existingProfile?.tenant_id ?? metaTenantId
    const role = existingProfile?.role ?? metaRole

    await serviceClient.from('profiles').upsert({
      id: user.id,
      tenant_id,
      role,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '',
    }, { onConflict: 'id', ignoreDuplicates: false })

    return Response.json({ success: true, tenant_id, role })
  } catch (error) {
    console.error('[auth/setup-profile POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
