import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/overview'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const meta = user.user_metadata
        const tenantId = meta?.tenant_id as string | undefined
        const role = meta?.role as string | undefined

        if (tenantId && role) {
          // Invited tenant admin — ensure profile row exists then go to onboarding
          const serviceClient = createServiceClient()
          await serviceClient.from('profiles').upsert({
            id: user.id,
            tenant_id: tenantId,
            role,
            full_name: (meta?.full_name as string | undefined) ?? user.email ?? '',
          }, { onConflict: 'id' })

          return NextResponse.redirect(`${origin}/onboarding/create-bot`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
