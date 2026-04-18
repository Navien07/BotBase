// app/api/bookings/[botId]/route.ts — List and create bookings

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
import { createCalendarEvent } from '@/lib/booking/google-calendar'
import { sendBookingConfirmation } from '@/lib/booking/notifications'
import type { Booking, Bot } from '@/types/database'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  status: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  service_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const CreateBookingSchema = z.object({
  booking_type: z.enum(['appointment', 'table', 'property_viewing']).default('appointment'),
  service_id: z.string().uuid().optional(),
  service_name: z.string().min(1).max(200).optional(),
  location: z.string().max(500).optional(),
  start_time: z.string().min(1),
  end_time: z.string().optional(),
  customer_name: z.string().min(1).max(200).optional(),
  customer_phone: z.string().max(30).optional(),
  customer_email: z.string().email().optional(),
  party_size: z.number().int().min(1).default(1),
  special_requests: z.string().max(2000).optional(),
  staff_notes: z.string().max(2000).optional(),
})

// ─── GET: paginated bookings list ─────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId)
  if (accessCheck instanceof Response) return accessCheck

  try {
    const url = new URL(req.url)
    const parsed = ListQuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return Response.json({ error: 'Invalid query params', details: parsed.error.flatten() }, { status: 400 })
    }

    const { status, date_from, date_to, service_id, page, limit } = parsed.data
    const offset = (page - 1) * limit

    const serviceClient = createServiceClient()
    let query = serviceClient
      .from('bookings')
      .select('*, services:service_id ( name )', { count: 'exact' })
      .eq('bot_id', botId)
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (date_from) query = query.gte('start_time', date_from)
    if (date_to) query = query.lte('start_time', date_to)
    if (service_id) query = query.eq('service_id', service_id)

    const { data, error, count } = await query
    if (error) throw error

    return Response.json({ bookings: data ?? [], total: count ?? 0, page, limit })
  } catch (error) {
    console.error('[bookings GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST: manual booking creation (admin walk-in) ────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId)
  if (accessCheck instanceof Response) return accessCheck

  try {
    const body = await req.json() as unknown
    const parsed = CreateBookingSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const auditEntry = {
      action: 'created',
      agent_id: user.id,
      timestamp: new Date().toISOString(),
      note: 'Walk-in booking created by admin',
    }

    const { data: booking, error } = await serviceClient
      .from('bookings')
      .insert({
        bot_id: botId,
        status: 'walk_in',
        booking_type: parsed.data.booking_type,
        service_id: parsed.data.service_id ?? null,
        service_name: parsed.data.service_name ?? null,
        location: parsed.data.location ?? null,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time ?? null,
        customer_name: parsed.data.customer_name ?? null,
        customer_phone: parsed.data.customer_phone ?? null,
        customer_email: parsed.data.customer_email ?? null,
        party_size: parsed.data.party_size,
        special_requests: parsed.data.special_requests ?? null,
        staff_notes: parsed.data.staff_notes ?? null,
        audit_log: [auditEntry],
      })
      .select('*')
      .single()

    if (error) throw error

    // Fire-and-forget: calendar + confirmation
    void (async () => {
      try {
        const { data: bot } = await serviceClient
          .from('bots')
          .select('*')
          .eq('id', botId)
          .single()
        if (bot) {
          createCalendarEvent(booking as Booking, bot as Bot).catch(console.error)
        }
        sendBookingConfirmation(booking.id).catch(console.error)
      } catch (e) {
        console.error('[bookings POST] side effects', e)
      }
    })()

    return Response.json({ booking }, { status: 201 })
  } catch (error) {
    console.error('[bookings POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
