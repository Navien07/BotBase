// app/api/followups/[botId]/[id]/queue/route.ts — Queue entries for a rule

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  try {
    const { data, error } = await service
      .from('followup_queue')
      .select(`
        id,
        status,
        attempt_count,
        next_attempt_at,
        last_attempt_at,
        created_at,
        contacts!inner(name, phone, channel)
      `)
      .eq('bot_id', botId)
      .eq('rule_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return Response.json({ queue: data ?? [] })
  } catch (error) {
    console.error('[followups/:id/queue GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
