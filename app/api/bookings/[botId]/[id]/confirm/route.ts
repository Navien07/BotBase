// app/api/bookings/[botId]/[id]/confirm/route.ts — Confirm a booking

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createCalendarEvent } from '@/lib/booking/google-calendar'
import { sendBookingConfirmation } from '@/lib/booking/notifications'
import { dispatchAdminNotification } from '@/lib/tenants/elken/booking/notifications'
import type { Booking, Bot } from '@/types/database'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
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
      action: 'confirmed',
      agent_id: user.id,
      timestamp: new Date().toISOString(),
      note: null,
    }

    const { data: booking, error } = await serviceClient
      .from('bookings')
      .update({
        status: 'confirmed',
        audit_log: [...currentAuditLog, auditEntry],
      })
      .eq('id', id)
      .eq('bot_id', botId)
      .select('*')
      .single()

    if (error) throw error

    // Fire-and-forget: calendar + notification
    void (async () => {
      try {
        const { data: bot } = await serviceClient
          .from('bots')
          .select('*')
          .eq('id', botId)
          .single()
        if (bot && !current.google_event_id) {
          const eventId = await createCalendarEvent(booking as Booking, bot as Bot)
          if (eventId) {
            await serviceClient
              .from('bookings')
              .update({ google_event_id: eventId })
              .eq('id', id)
          }
        }
        sendBookingConfirmation(id).catch(console.error)
        dispatchAdminNotification(botId, id, 'booking_confirmed')
          .catch(err => console.error('[BookingConfirm] Elken admin notification failed:', err))
      } catch (e) {
        console.error('[booking confirm] side effects', e)
      }
    })()

    return Response.json({ booking })
  } catch (error) {
    console.error('[booking confirm POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
