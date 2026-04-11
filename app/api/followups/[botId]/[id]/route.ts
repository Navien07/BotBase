// app/api/followups/[botId]/[id]/route.ts — Update or soft-delete a follow-up rule

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  trigger_condition: z.enum(['no_reply', 'booking_pending', 'lead_stage_change', 'keyword']).optional(),
  trigger_value: z.string().optional(),
  trigger_hours: z.number().int().min(1).max(720).optional(),
  message_template: z.string().min(1).max(4000).optional(),
  max_attempts: z.number().int().min(1).max(10).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = UpdateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    const { data, error } = await service
      .from('followup_rules')
      .update(parsed.data)
      .eq('id', id)
      .eq('bot_id', botId)
      .select('id, name, trigger_condition, trigger_hours, max_attempts, is_active')
      .single()

    if (error) throw error
    if (!data) return Response.json({ error: 'Not found' }, { status: 404 })

    return Response.json({ rule: data })
  } catch (error) {
    console.error('[followups/:id PATCH]', error)
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
    // Soft delete — set is_active = false
    const { error } = await service
      .from('followup_rules')
      .update({ is_active: false })
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error
    return Response.json({ success: true })
  } catch (error) {
    console.error('[followups/:id DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
