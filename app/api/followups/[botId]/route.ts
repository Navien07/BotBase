// app/api/followups/[botId]/route.ts — List + create follow-up rules

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateRuleSchema = z.object({
  name: z.string().min(1).max(200),
  trigger_condition: z.enum(['no_reply', 'booking_pending', 'lead_stage_change', 'keyword']),
  trigger_value: z.string().optional(),
  trigger_hours: z.number().int().min(1).max(720).default(24),
  message_template: z.string().min(1).max(4000),
  max_attempts: z.number().int().min(1).max(10).default(3),
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
    // Get rules with pending queue counts
    const { data: rules, error } = await service
      .from('followup_rules')
      .select('id, name, trigger_condition, trigger_hours, max_attempts, is_active, created_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get pending counts per rule
    const ruleIds = (rules ?? []).map((r) => r.id)
    let queueCounts: Record<string, number> = {}

    if (ruleIds.length > 0) {
      const { data: queueData } = await service
        .from('followup_queue')
        .select('rule_id, status')
        .eq('bot_id', botId)
        .in('rule_id', ruleIds)
        .eq('status', 'pending')

      for (const row of queueData ?? []) {
        queueCounts[row.rule_id] = (queueCounts[row.rule_id] ?? 0) + 1
      }
    }

    const rulesWithCounts = (rules ?? []).map((r) => ({
      ...r,
      pending_count: queueCounts[r.id] ?? 0,
    }))

    return Response.json({ rules: rulesWithCounts })
  } catch (error) {
    console.error('[followups GET]', error)
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
  const parsed = CreateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    const { data, error } = await service
      .from('followup_rules')
      .insert({
        bot_id: botId,
        name: parsed.data.name,
        trigger_condition: parsed.data.trigger_condition,
        trigger_hours: parsed.data.trigger_hours,
        message_template: parsed.data.message_template,
        max_attempts: parsed.data.max_attempts,
        is_active: true,
      })
      .select('id, name, trigger_condition, trigger_hours, max_attempts, is_active, created_at')
      .single()

    if (error) throw error
    return Response.json({ rule: data }, { status: 201 })
  } catch (error) {
    console.error('[followups POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
