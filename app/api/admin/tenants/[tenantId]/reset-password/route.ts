import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

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

    // Send password reset
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.botbase.ai'
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/set-password`,
    })
    console.log('resetPasswordForEmail result:', { email, error: resetError?.message ?? null })

    if (resetError) return Response.json({ error: resetError.message }, { status: 400 })

    return Response.json({ success: true, emailsSent: 1, email })
  } catch (error) {
    console.error('[admin/tenants/[tenantId]/reset-password POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
