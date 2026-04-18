// app/api/bookings/[botId]/[id]/route.ts — Single booking get + update

import { z } from 'zod'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/booking/google-calendar'
import type { Booking, Bot } from '@/types/database'

// ─── Schema ───────────────────────────────────────────────────────────────────

const UpdateBookingSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'reminded', 'completed', 'no_show', 'cancelled', 'walk_in']).optional(),
  service_id: z.string().uuid().optional(),
  service_name: z.string().max(200).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  location: z.string().max(500).optional(),
  customer_name: z.string().max(200).optional(),
  customer_phone: z.string().max(30).optional(),
  customer_email: z.string().email().optional(),
  party_size: z.number().int().min(1).optional(),
  special_requests: z.string().max(2000).optional(),
  staff_notes: z.string().max(2000).optional(),
  note: z.string().max(500).optional(),
})

// ─── GET: single booking with audit_log ───────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId)
  if (accessCheck instanceof Response) return accessCheck

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('bookings')
      .select('*, services:service_id ( name, duration_minutes, price, currency )')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'Booking not found' }, { status: 404 })
      }
      throw error
    }

    return Response.json({ booking: data })
  } catch (error) {
    console.error('[booking GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PATCH: update booking ────────────────────────────────────────────────────

export async function PATCH(
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
    const parsed = UpdateBookingSchema.safeParse(body)
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

    const { note, ...updates } = parsed.data

    const auditEntry = {
      action: updates.status ? `status_changed_to_${updates.status}` : 'updated',
      agent_id: user.id,
      timestamp: new Date().toISOString(),
      note: note ?? null,
    }

    const currentAuditLog = Array.isArray(current.audit_log) ? current.audit_log : []

    const { data: booking, error } = await serviceClient
      .from('bookings')
      .update({ ...updates, audit_log: [...currentAuditLog, auditEntry] })
      .eq('id', id)
      .eq('bot_id', botId)
      .select('*')
      .single()

    if (error) throw error

    // Post-response: calendar sync on status change.
    // after() keeps the function alive until the callback settles — safe in serverless.
    if (updates.status) {
      after(async () => {
        console.log('[GoogleCalendar:after] post-patch sync starting bookingId=', id, 'botId=', botId, 'status=', updates.status)
        try {
          const { data: bot } = await serviceClient
            .from('bots')
            .select('*')
            .eq('id', botId)
            .single()
          if (!bot) return

          if (updates.status === 'confirmed' && !current.google_event_id) {
            const eventId = await createCalendarEvent(booking as Booking, bot as Bot)
            if (eventId) {
              await serviceClient
                .from('bookings')
                .update({ google_event_id: eventId })
                .eq('id', id)
            }
          } else if (
            (updates.status === 'cancelled' || updates.status === 'no_show') &&
            current.google_event_id
          ) {
            await deleteCalendarEvent(current.google_event_id as string, bot as Bot)
          }
        } catch (e) {
          console.error('[booking PATCH] side effects', e)
        }
      })
    }

    return Response.json({ booking })
  } catch (error) {
    console.error('[booking PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
