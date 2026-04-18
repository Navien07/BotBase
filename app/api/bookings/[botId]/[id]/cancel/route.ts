// app/api/bookings/[botId]/[id]/cancel/route.ts — Cancel a booking

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
import { deleteCalendarEvent } from '@/lib/booking/google-calendar'
import type { Bot } from '@/types/database'

const CancelSchema = z.object({
  reason: z.string().max(500).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId)
  if (accessCheck instanceof Response) return accessCheck

  try {
    const body = await req.json() as unknown
    const parsed = CancelSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data: current, error: fetchError } = await serviceClient
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (fetchError || !current) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    const currentAuditLog = Array.isArray(current.audit_log) ? current.audit_log : []
    const auditEntry = {
      action: 'cancelled',
      agent_id: user.id,
      timestamp: new Date().toISOString(),
      note: parsed.data.reason ?? null,
    }

    const { data: booking, error } = await serviceClient
      .from('bookings')
      .update({
        status: 'cancelled',
        audit_log: [...currentAuditLog, auditEntry],
      })
      .eq('id', id)
      .eq('bot_id', botId)
      .select('*')
      .single()

    if (error) throw error

    // Fire-and-forget: delete calendar event
    if (current.google_event_id) {
      void (async () => {
        try {
          const { data: bot } = await serviceClient
            .from('bots')
            .select('*')
            .eq('id', botId)
            .single()
          if (bot) {
            await deleteCalendarEvent(current.google_event_id as string, bot as Bot)
          }
        } catch (e) {
          console.error('[booking cancel] calendar delete', e)
        }
      })()
    }

    return Response.json({ booking })
  } catch (error) {
    console.error('[booking cancel POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
