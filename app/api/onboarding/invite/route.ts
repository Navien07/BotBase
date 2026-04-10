import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { Resend } from 'resend'
import { logAudit } from '@/lib/audit/logger'

const schema = z.object({
  email: z.string().email(),
  tenant_id: z.string().uuid().optional(),
  bot_id: z.string().uuid().optional(),
  role: z.enum(['tenant_admin', 'agent']).default('tenant_admin'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only super admins can create invites
    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as unknown
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { email, tenant_id, bot_id, role } = parsed.data

    // Create invite record
    const { data: invite, error } = await service
      .from('tenant_invites')
      .insert({ email, tenant_id, bot_id, role, invited_by: user.id })
      .select('token')
      .single()

    if (error || !invite) {
      console.error('[invite POST] DB error:', error)
      return Response.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const inviteUrl = `${appUrl}/invite/${invite.token}`

    // Send invite email
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const resend = new Resend(resendKey)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@botbase.ai',
        to: email,
        subject: 'You have been invited to BotBase',
        html: `
          <p>You have been invited to join BotBase as a <strong>${role}</strong>.</p>
          <p><a href="${inviteUrl}">Accept Invite</a></p>
          <p>This link expires in 7 days.</p>
        `,
      })
    }

    await logAudit({
      action: 'invite_created',
      userId: user.id,
      metadata: { email, role, tenant_id },
    })

    return Response.json({ invite_url: inviteUrl })
  } catch (error) {
    console.error('[invite POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
