// app/api/cron/broadcasts/route.ts — Process scheduled broadcasts
// Vercel Cron: "*/5 * * * *"
// NO export const dynamic — incompatible with cacheComponents:true

import { createServiceClient } from '@/lib/supabase/service'
import { sendBroadcast } from '@/lib/broadcasts/campaign'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const now = new Date().toISOString()

    const { data: campaigns, error } = await supabase
      .from('broadcast_campaigns')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (error) throw error

    if (!campaigns || campaigns.length === 0) {
      return Response.json({ processed: 0 })
    }

    let processed = 0
    for (const { id } of campaigns) {
      try {
        // Mark sending synchronously, then fire-and-forget
        await supabase
          .from('broadcast_campaigns')
          .update({ status: 'sending', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('status', 'scheduled') // guard against race

        sendBroadcast(id).catch((e) =>
          console.error('[cron/broadcasts] background error', id, e)
        )
        processed++
      } catch (e) {
        console.error('[cron/broadcasts] failed for campaign', id, e)
      }
    }

    return Response.json({ processed })
  } catch (error) {
    console.error('[cron/broadcasts GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
