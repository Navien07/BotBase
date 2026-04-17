// app/api/auth/google/callback/route.ts — Handle Google Calendar OAuth callback

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, decrypt } from '@/lib/crypto/tokens'

// ─── Schemas and interfaces ───────────────────────────────────────────────────

const StateSchema = z.object({
  botId: z.string().uuid(),
  userId: z.string().uuid(),
  exp: z.number(),
})

interface GoogleTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  error_description?: string
}

interface GoogleUserInfo {
  email?: string
  id?: string
}

// ─── GET: OAuth callback from Google ─────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.botbase.ai'

  function errorRedirect(botId: string | null, reason: string) {
    if (botId) {
      return Response.redirect(
        `${appUrl}/dashboard/bots/${botId}/booking?tab=settings&google=error&reason=${reason}`
      )
    }
    return Response.redirect(`${appUrl}/dashboard?google=error&reason=${reason}`)
  }

  // ── Session check is first — required for all paths including cancelled ────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── User cancelled Google consent ─────────────────────────────────────────
  if (errorParam === 'access_denied') {
    // Only redirect to a specific bot page if state decrypts AND userId matches
    // the current session. Prevents an attacker from crafting a cancelled link
    // that leaks which botId a session has in-flight.
    let fallbackBotId: string | null = null
    if (stateParam && user) {
      try {
        const raw = JSON.parse(await decrypt(stateParam)) as unknown
        const parsed = StateSchema.safeParse(raw)
        if (parsed.success && parsed.data.userId === user.id) {
          fallbackBotId = parsed.data.botId
        }
      } catch { /* state unreadable — fall through to /dashboard */ }
    }
    const dest = fallbackBotId
      ? `${appUrl}/dashboard/bots/${fallbackBotId}/booking?tab=settings&google=cancelled`
      : `${appUrl}/dashboard`
    return Response.redirect(dest)
  }

  // ── Mandatory params ──────────────────────────────────────────────────────
  if (!stateParam || !code) {
    console.error('[google/callback] missing state or code params')
    return Response.redirect(`${appUrl}/dashboard?google=error&reason=missing_params`)
  }

  // ── Must be authenticated ─────────────────────────────────────────────────
  if (!user) {
    return Response.redirect(`${appUrl}/login`)
  }

  // ── Decrypt and validate state ────────────────────────────────────────────
  let botId: string
  try {
    const raw = JSON.parse(await decrypt(stateParam)) as unknown
    const parsed = StateSchema.safeParse(raw)

    if (!parsed.success) {
      console.error('[google/callback] state failed schema validation')
      return errorRedirect(null, 'invalid_state')
    }

    const { botId: bid, userId, exp } = parsed.data

    // Verify this callback belongs to the current session user
    if (userId !== user.id) {
      console.error('[google/callback] userId mismatch — possible CSRF or session change')
      return errorRedirect(null, 'auth_mismatch')
    }

    // Verify state hasn't expired (10-minute window set in initiate route)
    if (Date.now() > exp) {
      return errorRedirect(bid, 'expired')
    }

    botId = bid
  } catch (err) {
    console.error('[google/callback] state decryption failed:', err)
    return errorRedirect(null, 'invalid_state')
  }

  // ── Verify bot belongs to current user's tenant ───────────────────────────
  // Uses serviceClient to bypass RLS — ownership is verified manually below.
  const serviceClient = createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) {
    console.error('[google/callback] no tenant_id for user:', user.id)
    return errorRedirect(null, 'unauthorized')
  }

  const { data: ownedBot } = await serviceClient
    .from('bots')
    .select('id')
    .eq('id', botId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!ownedBot) {
    console.error('[google/callback] bot not owned by user — botId:', botId, 'userId:', user.id)
    return errorRedirect(null, 'unauthorized')
  }

  // ── Exchange authorization code for tokens ────────────────────────────────
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('[google/callback] Google OAuth env vars not set')
    return errorRedirect(botId, 'server_misconfigured')
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`
  let accessToken: string
  let refreshToken: string
  let expiresIn: number

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const data = await res.json() as GoogleTokenResponse

    if (!res.ok || data.error) {
      console.error('[google/callback] token exchange failed:', data.error, data.error_description)
      return errorRedirect(botId, 'token_exchange')
    }

    if (!data.access_token) {
      console.error('[google/callback] no access_token in Google response')
      return errorRedirect(botId, 'no_access_token')
    }

    // With prompt=consent, Google always returns a refresh_token.
    // If missing, something is wrong — do not proceed without it.
    if (!data.refresh_token) {
      console.error('[google/callback] no refresh_token — unexpected with prompt=consent')
      return errorRedirect(botId, 'no_refresh_token')
    }

    accessToken = data.access_token
    refreshToken = data.refresh_token
    expiresIn = data.expires_in ?? 3600
  } catch (err) {
    console.error('[google/callback] token exchange threw:', err)
    return errorRedirect(botId, 'token_exchange')
  }

  // ── Fetch connected Google account email ──────────────────────────────────
  // Best-effort — failure does not block the connect flow.
  let connectedEmail: string | null = null
  try {
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (userinfoRes.ok) {
      const userinfo = await userinfoRes.json() as GoogleUserInfo
      connectedEmail = userinfo.email ?? null
    } else {
      console.error('[google/callback] userinfo fetch returned non-ok:', userinfoRes.status)
    }
  } catch (err) {
    console.error('[google/callback] userinfo fetch threw (non-fatal):', err)
  }

  // ── Encrypt tokens and persist to DB ─────────────────────────────────────
  try {
    const [encryptedAccess, encryptedRefresh] = await Promise.all([
      encrypt(accessToken),
      encrypt(refreshToken),
    ])
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error } = await serviceClient
      .from('bots')
      .update({
        google_access_token: encryptedAccess,
        google_refresh_token: encryptedRefresh,
        google_token_expiry: expiresAt,
        google_connected_email: connectedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', botId)

    if (error) {
      console.error('[google/callback] DB update failed:', error)
      return errorRedirect(botId, 'db_error')
    }
  } catch (err) {
    console.error('[google/callback] encrypt/save threw:', err)
    return errorRedirect(botId, 'internal')
  }

  return Response.redirect(
    `${appUrl}/dashboard/bots/${botId}/booking?tab=settings&google=connected`
  )
}
