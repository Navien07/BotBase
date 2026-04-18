// app/api/auth/google/route.ts — Initiate Google Calendar OAuth flow

import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto/tokens'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const botId = searchParams.get('botId')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.botbase.ai'

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return Response.json({ error: 'Google OAuth not configured on this server' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.redirect(new URL('/login', appUrl))
  }

  // Encrypted state prevents CSRF — only the server can decrypt it.
  // userId is embedded so the callback can verify session continuity.
  const state = await encrypt(
    JSON.stringify({
      botId,
      userId: user.id,
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    })
  )

  const redirectUri = `${appUrl}/api/auth/google/callback`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events openid email'
  )
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent') // guarantees refresh_token on every connect
  authUrl.searchParams.set('state', state)

  return Response.redirect(authUrl.toString())
}
