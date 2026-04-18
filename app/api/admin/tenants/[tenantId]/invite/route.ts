import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { Resend } from 'resend'

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
      // Existing user — link their profile to THIS tenant and send invite via Resend
      await serviceClient.from('profiles').upsert({
        id: existingUser.id,
        tenant_id: tenantId,
        role: 'tenant_admin',
        full_name: (existingUser.user_metadata?.full_name as string | undefined) ?? existingUser.email ?? email,
      }, { onConflict: 'id', ignoreDuplicates: false })

      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/set-password`,
        },
      })

      if (linkError || !linkData) {
        return Response.json({ error: linkError?.message ?? 'Failed to generate invite link' }, { status: 400 })
      }

      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: emailError } = await resend.emails.send({
        from: 'Iceberg AI Solutions <noreply@icebergaisolutions.com>',
        to: email,
        subject: "You've been invited to IceBot — Set your password",
        html: `
          <h2>You've been invited to IceBot</h2>
          <p>Hi there,</p>
          <p>You've been given access to a IceBot AI chatbot dashboard by <strong>Iceberg AI Solutions</strong>.</p>
          <p>Click the link below to set your password and access your dashboard:</p>
          <p><a href="${linkData.properties.action_link}">Accept Invite &amp; Set Password</a></p>
          <p>This link expires in 24 hours.</p>
          <p>— Iceberg AI Solutions Team</p>
        `,
      })

      if (emailError) {
        return Response.json({ error: 'Failed to send email' }, { status: 500 })
      }

      return Response.json({ success: true, email, type: 'password_reset' })
    }

    // New user — send invite (inviteUserByEmail handles its own email via Supabase)
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
