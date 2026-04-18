// Tenant bot ID registry.
// Maps tenant names to their bot UUIDs. Used by runTenantHooks() to dispatch
// post-stream (and future) hooks without any generic-layer conditionals.
//
// When adding a new tenant extension:
//   1. Add the bot ID constant in the tenant's config.ts (not here).
//   2. Import and register it in TENANT_BOT_IDS below.
//   3. Add the hook dispatch branch in lib/tenants/index.ts.
//   4. Keep the tenant module itself in lib/tenants/<name>/.

import { ELKEN_BOT_ID } from './elken/config'
import { DR_AIMAN_BOT_ID } from './dr-aiman/media-triggers/config'

export { DR_AIMAN_BOT_ID }

export const TENANT_BOT_IDS = {
  elken: ELKEN_BOT_ID,
  'dr-aiman': DR_AIMAN_BOT_ID,
} as const

export type TenantName = keyof typeof TENANT_BOT_IDS

export function getTenantForBot(botId: string): TenantName | null {
  for (const [name, id] of Object.entries(TENANT_BOT_IDS)) {
    if (id === botId) return name as TenantName
  }
  return null
}
