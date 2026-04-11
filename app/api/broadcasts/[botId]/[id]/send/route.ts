// app/api/broadcasts/[botId]/[id]/send/route.ts — Trigger immediate send

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendBroadcast } from '@/lib/broadcasts/campaign'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  try {
    const { data: campaign } = await service
      .from('broadcast_campaigns')
      .select('status')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (!campaign) return Response.json({ error: 'Not found' }, { status: 404 })

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return Response.json(
        { error: `Cannot send a campaign with status: ${campaign.status}` },
        { status: 400 }
      )
    }

    // Fire-and-forget — do not await
    sendBroadcast(id).catch((e) =>
      console.error('[broadcasts/send] background error', id, e)
    )

    return Response.json({ message: 'Broadcast sending' })
  } catch (error) {
    console.error('[broadcasts/:id/send POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
