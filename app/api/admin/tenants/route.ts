import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { isSuperAdminEmail } from '@/lib/auth/super-admin'
import { Resend } from 'resend'

const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  adminEmail: z.string().email(),
  industry: z.string().min(1).max(100).optional(),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function GET() {
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

  if (!isSuperAdminEmail(user.email) && profile?.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {

    const { data: tenants, error } = await serviceClient
      .from('tenants')
      .select('id, name, slug, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get bot counts per tenant
    const { data: botCounts, error: botError } = await serviceClient
      .from('bots')
      .select('tenant_id')

    if (botError) throw botError

    const countMap: Record<string, number> = {}
    for (const bot of botCounts ?? []) {
      countMap[bot.tenant_id] = (countMap[bot.tenant_id] ?? 0) + 1
    }

    const result = (tenants ?? []).map((t) => ({
      ...t,
      bots_count: countMap[t.id] ?? 0,
    }))

    return Response.json({ tenants: result })
  } catch (error) {
    console.error('[admin/tenants GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
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

  if (!isSuperAdminEmail(user.email) && profile?.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createTenantSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, adminEmail } = parsed.data

  // Block super_admin emails from being used as tenant admins
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
  if (superAdminEmails.includes(adminEmail.toLowerCase())) {
    return Response.json(
      { error: 'This email belongs to a platform admin and cannot be used as a client admin.' },
      { status: 400 }
    )
  }

  try {
    // Generate unique slug
    const baseSlug = slugify(name)
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await serviceClient
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await serviceClient
      .from('tenants')
      .insert({ name, slug, is_active: true })
      .select()
      .single()

    if (tenantError) throw tenantError

    // Smart invite: check if email already has an auth account
    const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    const existingUser = usersData?.users.find(
      (u) => u.email?.toLowerCase() === adminEmail.toLowerCase()
    )

    let inviteType: 'invite' | 'password_reset'

    if (existingUser) {
      // Existing user — link to new tenant + send invite via Resend
      await serviceClient.from('profiles').upsert({
        id: existingUser.id,
        tenant_id: tenant.id,
        role: 'tenant_admin',
        full_name: (existingUser.user_metadata?.full_name as string | undefined) ?? existingUser.email ?? adminEmail,
      }, { onConflict: 'id', ignoreDuplicates: false })

      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: 'recovery',
        email: adminEmail,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/set-password`,
        },
      })

      if (linkError || !linkData) throw new Error(linkError?.message ?? 'Failed to generate invite link')

      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: emailError } = await resend.emails.send({
        from: 'Iceberg AI Solutions <noreply@icebergaisolutions.com>',
        to: adminEmail,
        subject: "You've been invited to BotBase — Set your password",
        html: `
          <h2>You've been invited to BotBase</h2>
          <p>Hi there,</p>
          <p>You've been given access to a BotBase AI chatbot dashboard by <strong>Iceberg AI Solutions</strong>.</p>
          <p>Click the link below to set your password and access your dashboard:</p>
          <p><a href="${linkData.properties.action_link}">Accept Invite &amp; Set Password</a></p>
          <p>This link expires in 24 hours.</p>
          <p>— Iceberg AI Solutions Team</p>
        `,
      })

      if (emailError) throw new Error('Failed to send email')
      inviteType = 'password_reset'
    } else {
      // New user — send invite
      const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
        adminEmail,
        { data: { tenant_id: tenant.id, role: 'tenant_admin' } }
      )
      if (inviteError) throw inviteError
      inviteType = 'invite'
    }

    // Re-lock the caller's super_admin profile in case inviteUserByEmail
    // overwrote raw_user_meta_data and triggered a profile update
    await serviceClient
      .from('profiles')
      .update({ role: 'super_admin', tenant_id: null })
      .eq('id', user.id)
      .eq('role', 'super_admin') // only fires if they were already super_admin

    return Response.json({ tenant, inviteSent: true, inviteType }, { status: 201 })
  } catch (error) {
    console.error('[admin/tenants POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
