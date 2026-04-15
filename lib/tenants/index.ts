// Tenant plugin registry.
// Core pipeline calls getTenantBookingHandler() — this is the ONLY
// place core code references tenant-specific logic.

import { handleElkenBookingFlow } from '@/lib/tenants/elken'
import type { PipelineContext, StepResult } from '@/lib/pipeline/types'

export { ELKEN_BOT_ID } from '@/lib/tenants/elken'

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
