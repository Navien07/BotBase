// app/api/bookings/[botId]/[id]/confirm/route.ts — Confirm a booking

import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
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

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

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

    // Post-response: calendar sync + notifications.
    // after() keeps the function alive until the callback settles — safe in serverless.
    after(async () => {
      console.log('[GoogleCalendar:after] post-confirm sync starting bookingId=', booking.id, 'botId=', botId)
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
    })

    return Response.json({ booking })
  } catch (error) {
    console.error('[booking confirm POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
