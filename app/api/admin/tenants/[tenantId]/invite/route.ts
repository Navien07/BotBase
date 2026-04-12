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

    // Check if this email already has an auth account
    const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    const existingUser = usersData?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (existingUser) {
      // Existing user — link their profile to THIS tenant and send password reset
      await serviceClient.from('profiles').upsert({
        id: existingUser.id,
        tenant_id: tenantId,
        role: 'tenant_admin',
        full_name: (existingUser.user_metadata?.full_name as string | undefined) ?? existingUser.email ?? email,
      }, { onConflict: 'id', ignoreDuplicates: false })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.botbase.ai'
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth/set-password`,
      })
      console.log('invite/reset result:', { email, type: 'password_reset', error: resetError?.message ?? null })
      if (resetError) throw resetError

      return Response.json({ success: true, email, type: 'password_reset' })
    }

    // New user — send invite
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          tenant_id: tenantId,
          role: 'tenant_admin',
        },
      }
    )
    console.log('invite/reset result:', { email, type: 'invite', error: inviteError?.message ?? null })

    if (inviteError) throw inviteError

    if (inviteData?.user?.id) {
      await serviceClient.from('profiles').upsert({
        id: inviteData.user.id,
        tenant_id: tenantId,
        role: 'tenant_admin',
        full_name: inviteData.user.email ?? email,
      }, { onConflict: 'id', ignoreDuplicates: false })
    }

    return Response.json({ success: true, email, type: 'invite' })
  } catch (error) {
    console.error('[admin/tenants/[tenantId]/invite POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
