import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
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
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get all tenant admin profile IDs
    const { data: adminProfiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'tenant_admin')

    if (profilesError) throw profilesError
    if (!adminProfiles || adminProfiles.length === 0) {
      return Response.json({ error: 'No admins found for this tenant' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.botbase.ai'
    let emailsSent = 0

    for (const adminProfile of adminProfiles) {
      // Get email from auth.users
      const { data: authUser, error: userError } = await serviceClient.auth.admin.getUserById(adminProfile.id)
      if (userError || !authUser?.user?.email) continue

      // Send password reset — redirects to /login where the hash is intercepted
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        authUser.user.email,
        { redirectTo: `${appUrl}/login` }
      )
      if (!resetError) emailsSent++
    }

    return Response.json({ success: true, emailsSent })
  } catch (error) {
    console.error('[admin/tenants/[tenantId]/reset-password POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
