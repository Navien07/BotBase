// app/api/broadcasts/[botId]/[id]/schedule/route.ts — Schedule a campaign

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ScheduleSchema = z.object({
  scheduled_at: z.string().datetime(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { scheduled_at } = parsed.data

  if (new Date(scheduled_at) <= new Date()) {
    return Response.json({ error: 'scheduled_at must be in the future' }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    const { data: campaign } = await service
      .from('broadcast_campaigns')
      .select('status')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (!campaign) return Response.json({ error: 'Not found' }, { status: 404 })
    if (campaign.status !== 'draft') {
      return Response.json({ error: 'Only draft campaigns can be scheduled' }, { status: 400 })
    }

    const { data, error } = await service
      .from('broadcast_campaigns')
      .update({
        status: 'scheduled',
        scheduled_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('bot_id', botId)
      .select('id, status, scheduled_at')
      .single()

    if (error) throw error
    return Response.json({ campaign: data })
  } catch (error) {
    console.error('[broadcasts/:id/schedule POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
