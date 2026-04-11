// app/api/broadcasts/[botId]/route.ts — List + create broadcast campaigns

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  channel: z.enum(['whatsapp', 'telegram', 'web', 'all']),
  message_body: z.string().min(1).max(4000),
  media_url: z.string().url().nullable().optional(),
  quick_replies: z.array(z.string()).default([]),
  audience_filter: z.record(z.string(), z.unknown()).default({}),
  scheduled_at: z.string().datetime().nullable().optional(),
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  try {
    const { data, error } = await service
      .from('broadcast_campaigns')
      .select('id, name, channel, status, stats, scheduled_at, sent_at, created_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return Response.json({ campaigns: data ?? [] })
  } catch (error) {
    console.error('[broadcasts GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, channel, message_body, media_url, quick_replies, audience_filter, scheduled_at } = parsed.data

  const service = createServiceClient()

  try {
    const { data, error } = await service
      .from('broadcast_campaigns')
      .insert({
        bot_id: botId,
        name,
        channel,
        message_template: {
          body: message_body,
          media_url: media_url ?? null,
          buttons: quick_replies,
        },
        audience_filter,
        status: scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: scheduled_at ?? null,
        created_by: user.id,
      })
      .select('id, name, channel, status, created_at')
      .single()

    if (error) throw error
    return Response.json({ campaign: data }, { status: 201 })
  } catch (error) {
    console.error('[broadcasts POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
