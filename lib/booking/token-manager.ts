// lib/booking/token-manager.ts — Google OAuth token decryption, validation, and refresh

import { decrypt, encrypt } from '@/lib/crypto/tokens'
import { createServiceClient } from '@/lib/supabase/service'
import type { Bot } from '@/types/database'

/**
 * Returns a valid, decrypted Google access token for the given bot.
 *
 * Token flow:
 *   1. Decrypt stored access token
 *   2. If expiry exists and > 60s away → return decrypted access token
 *   3. If expiry exists and expired → refresh path
 *   4. If NO expiry stored → treat as expired (log warning, go to refresh)
 *   5. Refresh: decrypt refresh token → call Google → await persist → return new token
 *
 * Never throws. Returns null on any unrecoverable failure.
 */
export async function getValidAccessToken(bot: Bot): Promise<string | null> {
  if (!bot.google_access_token) return null

  // ── Decrypt stored access token ───────────────────────────────────────────
  let plainAccessToken: string
  try {
    plainAccessToken = await decrypt(bot.google_access_token)
  } catch (err) {
    console.error('[token-manager] failed to decrypt access token:', err)
    return null
  }

  // ── Expiry check ──────────────────────────────────────────────────────────
  if (bot.google_token_expiry) {
    const expiry = new Date(bot.google_token_expiry)
    if (expiry.getTime() > Date.now() + 60_000) {
      // Token is valid for at least another 60 seconds
      return plainAccessToken
    }
    // Expired — fall through to refresh
  } else {
    // No expiry stored: post-Commit-2 this shouldn't happen, but defensively refresh
    console.warn('[token-manager] expiry missing — proactive refresh')
    // Fall through to refresh
  }

  // ── Refresh path ──────────────────────────────────────────────────────────
  if (!bot.google_refresh_token) {
    console.error('[token-manager] token expired but no refresh token stored for bot', bot.id)
    return null
  }

  let plainRefreshToken: string
  try {
    plainRefreshToken = await decrypt(bot.google_refresh_token)
  } catch (err) {
    console.error('[token-manager] failed to decrypt refresh token:', err)
    return null
  }

  let newAccessToken: string
  let newExpiry: string
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: plainRefreshToken,
        grant_type:    'refresh_token',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[token-manager] Google refresh failed:', res.status, body)
      return null
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) {
      console.error('[token-manager] Google refresh response missing access_token')
      return null
    }

    newAccessToken = data.access_token
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
    newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString()
  } catch (err) {
    console.error('[token-manager] fetch to Google token endpoint failed:', err)
    return null
  }

  // ── Persist refreshed token (awaited — prevents stale-token race) ─────────
  try {
    const encryptedNewAccess = await encrypt(newAccessToken)
    const { error } = await createServiceClient()
      .from('bots')
      .update({
        google_access_token: encryptedNewAccess,
        google_token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bot.id)

    if (error) {
      // Log but do not fail — caller gets the in-memory token; next call refreshes again
      console.error('[token-manager] failed to persist refreshed token for bot', bot.id, error)
    }
  } catch (err) {
    console.error('[token-manager] encrypt/persist error:', err)
  }

  return newAccessToken
}
