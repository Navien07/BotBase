import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { Resend } from 'resend'

const resetSchema = z.object({
  email: z.string().email(),
})

export async function POST(
  req: Request,
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const { email } = parsed.data

  try {
    // Find the user by email
    const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    const targetUser = usersData?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!targetUser) {
      return Response.json({ error: 'No account found with that email address' }, { status: 404 })
    }

    // Verify they're actually an admin for this tenant
    const { data: targetProfile } = await serviceClient
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', targetUser.id)
      .single()

    if (!targetProfile || targetProfile.tenant_id !== tenantId) {
      return Response.json({ error: 'This email is not an admin for this client' }, { status: 404 })
    }

    // Ensure profile is pinned to this tenant before sending reset link
    await serviceClient.from('profiles').upsert({
      id: targetUser.id,
      tenant_id: tenantId,
      role: 'tenant_admin',
    }, { onConflict: 'id', ignoreDuplicates: false })

    // Generate password reset link via admin API (bypasses unreliable Supabase SMTP)
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/set-password`,
      },
    })

    if (linkError || !linkData) {
      return Response.json({ error: linkError?.message ?? 'Failed to generate reset link' }, { status: 400 })
    }

    // Send via Resend directly
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'Iceberg AI Solutions <noreply@icebergaisolutions.com>',
      to: email,
      subject: 'Set your IceBot password',
      html: `
        <h2>Set Your IceBot Password</h2>
        <p>Hi there,</p>
        <p>Click the link below to set your password for your IceBot account:</p>
        <p><a href="${linkData.properties.action_link}">Set Password &amp; Access Dashboard</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>— Iceberg AI Solutions Team</p>
      `,
    })

    if (emailError) {
      return Response.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return Response.json({ success: true, emailsSent: 1, email })
  } catch (error) {
    console.error('[admin/tenants/[tenantId]/reset-password POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
