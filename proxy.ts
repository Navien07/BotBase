import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Public paths that bypass authentication
const PUBLIC_PATHS = [
  '/api/chat/',
  '/api/webhook/',
  '/api/widget/',
  '/chat/',
  '/invite/',
  '/auth/',
  '/login',
  '/_next/',
  '/favicon.ico',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always run updateSession so Supabase can refresh the token and set cookies.
  // For public paths we still return the supabaseResponse so cookies are forwarded.
  const { supabaseResponse: sessionResponse, user } = await updateSession(request)
  let response = sessionResponse

  // Redirect authenticated users away from login — must run BEFORE isPublicPath
  // so /login (a public path) still gets the auth-redirect treatment.
  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard/overview'
    response = NextResponse.redirect(redirectUrl)
    return response
  }

  // Bypass auth gate for public paths — but keep the supabase cookie response
  if (isPublicPath(pathname)) {
    return response
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    response = NextResponse.redirect(loginUrl)
    return response
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
