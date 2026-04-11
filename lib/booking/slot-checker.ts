// lib/booking/slot-checker.ts — Slot availability and next-slot finder

import { createServiceClient } from '@/lib/supabase/service'
import type { OperatingHoursRow } from './types'

export async function checkSlotAvailability(
  botId: string,
  serviceId: string,
  datetime: Date
): Promise<{ available: boolean; capacity: number; booked: number }> {
  const supabase = createServiceClient()

  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, buffer_minutes, max_simultaneous')
    .eq('id', serviceId)
    .eq('bot_id', botId)
    .single()

  if (!service) return { available: false, capacity: 0, booked: 0 }

  const slotDuration = (service.duration_minutes as number) + (service.buffer_minutes as number)
  const slotStart = datetime.toISOString()
  const slotEnd = new Date(datetime.getTime() + slotDuration * 60_000).toISOString()
  const capacity = service.max_simultaneous as number

  // Count overlapping confirmed/pending bookings
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('bot_id', botId)
    .eq('service_id', serviceId)
    .in('status', ['confirmed', 'pending'])
    .lt('start_time', slotEnd)
    .gt('end_time', slotStart)

  const booked = count ?? 0
  return { available: booked < capacity, capacity, booked }
}

export async function findNextAvailableSlots(
  botId: string,
  serviceId: string,
  afterDate: Date,
  count = 3
): Promise<Date[]> {
  const supabase = createServiceClient()

  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, buffer_minutes, max_simultaneous')
    .eq('id', serviceId)
    .eq('bot_id', botId)
    .single()

  if (!service) return []

  const { data: hoursRows } = await supabase
    .from('operating_hours')
    .select('*')
    .eq('bot_id', botId)
    .order('day_of_week')

  if (!hoursRows || hoursRows.length === 0) return []

  const hours = hoursRows as OperatingHoursRow[]
  const stepMinutes = (service.duration_minutes as number) + (service.buffer_minutes as number)

  const slots: Date[] = []
  const candidate = new Date(afterDate)
  // Round up to next full hour
  candidate.setMinutes(0, 0, 0)
  candidate.setHours(candidate.getHours() + 1)

  let iterations = 0

  while (slots.length < count && iterations < 300) {
    iterations++

    const dayHours = hours.find((h) => h.day_of_week === candidate.getDay())

    if (!dayHours?.is_open) {
      advanceToNextDay(candidate)
      continue
    }

    const [openH, openM] = toHHMM(dayHours.open_time)
    const [closeH, closeM] = toHHMM(dayHours.close_time)
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM
    const candidateMinutes = candidate.getHours() * 60 + candidate.getMinutes()

    // Before opening → jump to open time
    if (candidateMinutes < openMinutes) {
      candidate.setHours(openH, openM, 0, 0)
    }

    // After last viable slot for today → move to tomorrow
    if (candidate.getHours() * 60 + candidate.getMinutes() > closeMinutes - (service.duration_minutes as number)) {
      advanceToNextDay(candidate)
      continue
    }

    // Skip lunch break
    if (dayHours.lunch_start && dayHours.lunch_end) {
      const [lsH, lsM] = toHHMM(dayHours.lunch_start)
      const [leH, leM] = toHHMM(dayHours.lunch_end)
      const lunchStart = lsH * 60 + lsM
      const lunchEnd = leH * 60 + leM
      const cur = candidate.getHours() * 60 + candidate.getMinutes()
      if (cur >= lunchStart && cur < lunchEnd) {
        candidate.setHours(leH, leM, 0, 0)
        continue
      }
    }

    const { available } = await checkSlotAvailability(botId, serviceId, new Date(candidate))
    if (available) {
      slots.push(new Date(candidate))
    }

    // Step forward by service duration + buffer
    candidate.setMinutes(candidate.getMinutes() + stepMinutes)
  }

  return slots
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHHMM(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number)
  return [h ?? 0, m ?? 0]
}

function advanceToNextDay(date: Date): void {
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
}
