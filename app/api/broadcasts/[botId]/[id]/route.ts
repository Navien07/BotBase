// app/api/broadcasts/[botId]/[id]/route.ts — Get, update, delete a campaign

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  message_body: z.string().min(1).max(4000).optional(),
  media_url: z.string().url().nullable().optional(),
  quick_replies: z.array(z.string()).optional(),
  audience_filter: z.record(z.string(), z.unknown()).optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
})

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
      .from('broadcast_campaigns')
      .select('*')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (error || !data) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    return Response.json({ campaign: data })
  } catch (error) {
    console.error('[broadcasts/:id GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = UpdateCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    // Only allow editing drafts
    const { data: existing } = await service
      .from('broadcast_campaigns')
      .select('status, message_template')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'draft') {
      return Response.json({ error: 'Only draft campaigns can be edited' }, { status: 400 })
    }

    const { name, message_body, media_url, quick_replies, audience_filter, scheduled_at } = parsed.data

    const currentTemplate = (existing.message_template ?? {}) as Record<string, unknown>
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (name !== undefined) updates.name = name
    if (audience_filter !== undefined) updates.audience_filter = audience_filter
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at

    if (message_body !== undefined || media_url !== undefined || quick_replies !== undefined) {
      updates.message_template = {
        body: message_body ?? currentTemplate.body ?? '',
        media_url: media_url !== undefined ? media_url : (currentTemplate.media_url ?? null),
        buttons: quick_replies ?? currentTemplate.buttons ?? [],
      }
    }

    const { data, error } = await service
      .from('broadcast_campaigns')
      .update(updates)
      .eq('id', id)
      .eq('bot_id', botId)
      .select('id, name, channel, status, message_template, audience_filter, scheduled_at, updated_at')
      .single()

    if (error) throw error
    return Response.json({ campaign: data })
  } catch (error) {
    console.error('[broadcasts/:id PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  try {
    const { data: existing } = await service
      .from('broadcast_campaigns')
      .select('status')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'draft') {
      return Response.json({ error: 'Only draft campaigns can be deleted' }, { status: 400 })
    }

    const { error } = await service
      .from('broadcast_campaigns')
      .delete()
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error
    return Response.json({ success: true })
  } catch (error) {
    console.error('[broadcasts/:id DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
