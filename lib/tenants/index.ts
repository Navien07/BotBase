// Tenant plugin registry.
// Two responsibilities:
//   1. getTenantBookingHandler() — routes booking step to the right tenant state machine.
//   2. runTenantHooks()         — fires post-stream (and future) per-tenant side effects.
//
// These are the ONLY places core code references tenant-specific logic.

import { handleElkenBookingFlow } from '@/lib/tenants/elken'
import type { PipelineContext, StepResult } from '@/lib/pipeline/types'
import type { Bot } from '@/types/database'
import { getTenantForBot } from './registry'

export { ELKEN_BOT_ID } from '@/lib/tenants/elken'
export { DR_AIMAN_BOT_ID, getTenantForBot } from './registry'

// ─── Booking handler (existing) ───────────────────────────────────────────────

const HANDLERS: Array<(ctx: PipelineContext, start: number) => Promise<StepResult | null>> = [
  handleElkenBookingFlow,
]

export async function getTenantBookingHandler(
  ctx: PipelineContext,
  start: number
): Promise<StepResult | null> {
  for (const handler of HANDLERS) {
    const result = await handler(ctx, start)
    if (result !== null) return result
  }
  return null
}

export function isTenantBot(botId: string): boolean {
  return botId === '21794953-b13f-4e5f-984a-1536c453461d'
}

// ─── Post-stream hook types ───────────────────────────────────────────────────

export type TenantHookName = 'post-stream'

export interface PostStreamContext {
  botId: string
  conversationId: string
  contactId: string | null
  userMessage: string
  assistantResponse: string
  bot: Bot
}

// ─── Hook dispatcher ──────────────────────────────────────────────────────────

export async function runTenantHooks(
  hookName: TenantHookName,
  botId: string,
  ctx: PostStreamContext
): Promise<void> {
  const tenant = getTenantForBot(botId)
  if (!tenant) return

  try {
    if (tenant === 'dr-aiman' && hookName === 'post-stream') {
      const { handlePostStream } = await import('./dr-aiman')
      await handlePostStream(ctx)
    }
    // Add future tenants / hooks here.
  } catch (err) {
    console.error(`[tenant-hook ${tenant}/${hookName}]`, err)
  }
}
