/**
 * lib/auth/require-bot-access.ts
 *
 * Single source of truth for dashboard route authorization.
 * Every authenticated route that reads or writes bot data must call this.
 *
 * Returns { tenantId } on success.
 * Returns a 404 Response on any failure — always 404, never 403, so we do
 * not leak "bot exists but you can't access it" vs. "bot doesn't exist".
 *
 * // PERF: 2 sequential queries per call (~20ms). If this becomes a hot path,
 * // consider combining via a single RPC that joins profiles + bots.
 *
 * Smoke test matrix (run after any auth change):
 *   1. User A (tenant X) → User B's botId (tenant Y)          → 404
 *   2. User with null tenant_id → any botId                   → 404
 *   3. super_admin email → any tenant's botId                 → 200
 *   4. Non-existent userId → any botId                        → 404
 *   5. Valid user → non-existent botId                        → 404
 *   6. Valid user → own tenant's valid botId                  → 200
 */

import { createServiceClient } from '@/lib/supabase/service'
import { isSuperAdminEmail } from '@/lib/auth/super-admin'

export type BotAccessResult = { tenantId: string }

export async function requireBotAccess(
  userId: string,
  botId: string,
  options?: { userEmail?: string | null }
): Promise<BotAccessResult | Response> {
  const serviceClient = createServiceClient()

  // SECURITY: super-admin identity is verified via SUPER_ADMIN_EMAILS env var,
  // not profiles.role. JWT email is non-mutable; profiles.role can be flipped
  // by malicious DB writes. See lib/auth/super-admin.ts. Other parts of the
  // codebase still use profiles.role — that is tech debt, do not "fix" this
  // helper to match. See memory: "Migrate role checks to isSuperAdminEmail".
  if (options?.userEmail && isSuperAdminEmail(options.userEmail)) {
    const { data: bot, error } = await serviceClient
      .from('bots')
      .select('tenant_id')
      .eq('id', botId)
      .single()

    if (error) console.error('[requireBotAccess] bot lookup (super_admin):', error)
    if (error || !bot) return Response.json({ error: 'Not found' }, { status: 404 })

    return { tenantId: bot.tenant_id as string }
  }

  // ── Tenant user: verify profile exists and has a tenant ──
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  if (profileError) console.error('[requireBotAccess] profile lookup:', profileError)
  if (profileError || !profile?.tenant_id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // ── Verify bot belongs to this tenant ──
  const { data: bot, error: botError } = await serviceClient
    .from('bots')
    .select('id')
    .eq('id', botId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (botError) console.error('[requireBotAccess] bot ownership check:', botError)
  if (botError || !bot) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return { tenantId: profile.tenant_id }
}
