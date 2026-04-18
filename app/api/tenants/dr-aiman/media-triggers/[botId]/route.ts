import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { DR_AIMAN_BOT_ID } from '@/lib/tenants/dr-aiman/media-triggers/config'
import type { BotMediaTrigger } from '@/types/database'

export type MediaTriggerWithPreview = BotMediaTrigger & {
  signed_preview_url: string | null
}

// GET — list all media triggers (active + inactive), with 1h signed preview URLs.
// Ordered by trigger_value ASC then display_order ASC so tabs render in stable order.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  // Gate: Dr. Aiman bot only — return 404 for any other bot (does not leak existence)
  if (botId !== DR_AIMAN_BOT_ID) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(user.id, RATE_LIMITS.dashboard)
  if (!rl.allowed) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  try {
    const serviceClient = createServiceClient()

    const { data: triggers, error } = await serviceClient
      .from('bot_media_triggers')
      .select('*')
      .eq('bot_id', botId)
      .order('trigger_value', { ascending: true })
      .order('display_order', { ascending: true })

    if (error) throw error

    // Generate signed preview URLs in parallel — 1h expiry is enough for dashboard use
    const withUrls: MediaTriggerWithPreview[] = await Promise.all(
      (triggers ?? []).map(async (t) => {
        const { data: signed } = await serviceClient
          .storage
          .from('bot-files')
          .createSignedUrl(t.storage_path, 3600)
        return {
          ...(t as BotMediaTrigger),
          signed_preview_url: signed?.signedUrl ?? null,
        }
      })
    )

    return Response.json({ triggers: withUrls })
  } catch (error) {
    console.error('[dr-aiman/media-triggers GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
