import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any logic between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Authenticated user hitting /login → send to dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/overview'
    const redirect = NextResponse.redirect(url)
    // Copy ALL session cookies onto the redirect — critical for rotating refresh tokens
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value)
    })
    return redirect
  }

  // Unauthenticated user hitting protected route → send to login
  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value)
    })
    return redirect
  }

  // New authenticated user hitting /dashboard/* → redirect to onboarding if not completed
  if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/api')) {
    try {
      const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceUrl && serviceKey) {
        const serviceSupabase = createSupabaseServiceClient(serviceUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        // Fetch role + tenant_id for this user
        const { data: profile } = await serviceSupabase
          .from('profiles')
          .select('role, tenant_id')
          .eq('id', user.id)
          .single()

        // Super admins never need onboarding
        if (profile?.role === 'super_admin') {
          // fall through — no onboarding redirect
        } else if (profile?.tenant_id) {
          // Check if tenant has any bots (set up by super_admin) or completed onboarding
          const [{ data: progress }, { data: bots }] = await Promise.all([
            serviceSupabase
              .from('onboarding_progress')
              .select('completed_at')
              .eq('tenant_id', profile.tenant_id)
              .single(),
            serviceSupabase
              .from('bots')
              .select('id')
              .eq('tenant_id', profile.tenant_id)
              .limit(1),
          ])

          const hasBots = (bots ?? []).length > 0
          const onboardingDone = progress?.completed_at

          // No bots and onboarding not complete → redirect to onboarding
          if (!hasBots && !onboardingDone) {
            const url = request.nextUrl.clone()
            url.pathname = '/onboarding/create-bot'
            const redirect = NextResponse.redirect(url)
            supabaseResponse.cookies.getAll().forEach((cookie) => {
              redirect.cookies.set(cookie.name, cookie.value)
            })
            return redirect
          }
        }
      }
    } catch {
      // Never block dashboard access on onboarding check failure
    }
  }

  // Always return supabaseResponse — never return NextResponse.next() directly
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhook|api/chat|api/widget|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
