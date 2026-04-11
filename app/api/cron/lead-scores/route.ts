// app/api/cron/lead-scores/route.ts — Recalculate lead scores for active contacts
// Vercel Cron: "0 3 * * *"
// NO export const dynamic — incompatible with cacheComponents:true

import { createServiceClient } from '@/lib/supabase/service'
import { calculateLeadScore } from '@/lib/crm/lead-score'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()

    // Get all bots with CRM enabled
    const { data: bots, error: botsErr } = await supabase
      .from('bots')
      .select('id')
      .filter('feature_flags->>crm_enabled', 'eq', 'true')

    if (botsErr) throw botsErr

    if (!bots || bots.length === 0) {
      return Response.json({ processed: 0 })
    }

    const botIds = bots.map((b) => b.id)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()

    // Get contacts active in last 30 days
    const { data: contacts, error: contactsErr } = await supabase
      .from('contacts')
      .select('id')
      .in('bot_id', botIds)
      .gte('last_message_at', cutoff)

    if (contactsErr) throw contactsErr

    let processed = 0
    for (const contact of contacts ?? []) {
      try {
        const score = await calculateLeadScore(contact.id)
        await supabase
          .from('contacts')
          .update({ lead_score: score })
          .eq('id', contact.id)
        processed++
      } catch (e) {
        console.error('[cron/lead-scores] contact', contact.id, e)
      }
    }

    return Response.json({ processed })
  } catch (error) {
    console.error('[cron/lead-scores GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
