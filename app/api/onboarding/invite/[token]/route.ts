import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/logger'

// GET /api/onboarding/invite/[token] — validate token
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const service = createServiceClient()

    const { data: invite, error } = await service
      .from('tenant_invites')
      .select('id, email, role, tenant_id, accepted_at, expires_at')
      .eq('token', token)
      .single()

    if (error || !invite) {
      return Response.json({ valid: false, error: 'Invite not found' })
    }
    if (invite.accepted_at) {
      return Response.json({ valid: false, error: 'Invite already accepted' })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return Response.json({ valid: false, error: 'Invite has expired' })
    }

    return Response.json({ valid: true, email: invite.email, role: invite.role })
  } catch (error) {
    console.error('[invite GET]', error)
    return Response.json({ valid: false, error: 'Internal server error' })
  }
}

const acceptSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(100),
})

// POST /api/onboarding/invite/[token]/accept — create user + assign role
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const service = createServiceClient()

    // Validate token
    const { data: invite, error: inviteError } = await service
      .from('tenant_invites')
      .select('*')
      .eq('token', token)
      .single()

    if (inviteError || !invite) {
      return Response.json({ error: 'Invalid invite token' }, { status: 400 })
    }
    if (invite.accepted_at) {
      return Response.json({ error: 'Invite already accepted' }, { status: 400 })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: 'Invite has expired' }, { status: 400 })
    }

    const body = await req.json() as unknown
    const parsed = acceptSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { email, password, display_name } = parsed.data

    if (email !== invite.email) {
      return Response.json({ error: 'Email does not match invite' }, { status: 400 })
    }

    // Create Supabase auth user
    const { data: newUser, error: signupError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (signupError || !newUser.user) {
      console.error('[invite accept] createUser error:', signupError)
      return Response.json(
        { error: signupError?.message ?? 'Failed to create user' },
        { status: 500 }
      )
    }

    const userId = newUser.user.id

    // Update profile: set role, display_name, tenant_id
    await service
      .from('profiles')
      .upsert({
        id: userId,
        role: invite.role,
        tenant_id: invite.tenant_id,
        display_name,
      })

    // Mark invite accepted
    await service
      .from('tenant_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    // Create onboarding progress for tenant
    if (invite.tenant_id) {
      await service
        .from('onboarding_progress')
        .upsert({ tenant_id: invite.tenant_id }, { onConflict: 'tenant_id', ignoreDuplicates: true })
    }

    await logAudit({
      action: 'invite_accepted',
      userId,
      tenantId: invite.tenant_id ?? undefined,
      metadata: { email, role: invite.role },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('[invite accept POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
