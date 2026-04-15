// ELKEN TENANT PLUGIN — do not import outside lib/tenants/elken/

import { createServiceClient } from '@/lib/supabase/service'
import { ELKEN_BOT_ID, ELKEN_LOCATIONS, ELKEN_FACILITIES } from '@/lib/tenants/elken/config'
import type { ElkenFacilityId, ElkenLocation } from '@/lib/tenants/elken/config'
import type { ElkenBookingState } from '@/lib/tenants/elken/booking/types'

export interface SlotCheckResult {
  available: boolean
  alternatives: string[]  // human-readable formatted slot labels
}

/**
 * Check if a requested slot is available for the given Elken booking state.
 * Uses ELKEN_FACILITIES config for capacity and timing rules.
 * Never throws — returns available:true on any parse failure.
 */
export async function checkElkenSlot(state: ElkenBookingState): Promise<SlotCheckResult> {
  const { facility, location, preferred_datetime, duration } = state

  if (!facility || !location || !preferred_datetime) {
    return { available: true, alternatives: [] }
  }

  const facilityId = facility as ElkenFacilityId
  const loc = location as ElkenLocation

  const requestedAt = new Date(preferred_datetime)
  if (isNaN(requestedAt.getTime())) {
    // Unparseable datetime — don't block the flow
    return { available: true, alternatives: [] }
  }

  const capacity = getFacilityCapacity(facilityId, loc)
  if (capacity === 0) {
    return { available: false, alternatives: [] }
  }

  const windowMs = getWindowMinutes(facilityId, duration ?? undefined) * 60 * 1000
  const windowStart = new Date(requestedAt.getTime() - windowMs / 2)
  const windowEnd = new Date(requestedAt.getTime() + windowMs / 2)

  const supabase = createServiceClient()

  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('bot_id', ELKEN_BOT_ID)
    .eq('metadata->>facility_id', facilityId)
    .eq('metadata->>location_id', loc)
    .in('status', ['pending', 'confirmed', 'trial_pending'])
    .gte('start_time', windowStart.toISOString())
    .lt('start_time', windowEnd.toISOString())

  const booked = count ?? 0
  if (booked < capacity) {
    return { available: true, alternatives: [] }
  }

  const alternatives = await findNextSlots(facilityId, loc, requestedAt, duration ?? undefined, 3)
  return { available: false, alternatives }
}

/** Format an ISO date string into a human-readable MY timezone label */
export function formatSlotLabel(isoString: string): string {
  return new Date(isoString).toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function getFacilityCapacity(facilityId: ElkenFacilityId, loc: ElkenLocation): number {
  const f = ELKEN_FACILITIES[facilityId]
  const cap = (f as { capacity: Partial<Record<string, number>> }).capacity
  return cap?.[loc] ?? 0
}

function getWindowMinutes(facilityId: ElkenFacilityId, duration?: string): number {
  if (facilityId === 'inhaler') return duration === '30min' ? 30 : 60
  if (facilityId === 'room_small' || facilityId === 'room_large') return 60
  return 90 // beds
}

function isOperatingHour(date: Date, loc: ElkenLocation): boolean {
  const day = date.getDay()  // 0=Sun, 6=Sat
  const timeMin = date.getHours() * 60 + date.getMinutes()

  if (loc === 'subang') {
    if (day === 0 || day === 6) return false  // weekdays only
    return timeMin >= 10 * 60 && timeMin < 18 * 60 + 30
  }
  // OKR: daily 10:00–22:00
  return timeMin >= 10 * 60 && timeMin < 22 * 60
}

async function findNextSlots(
  facilityId: ElkenFacilityId,
  loc: ElkenLocation,
  afterDate: Date,
  duration: string | undefined,
  maxCount: number
): Promise<string[]> {
  const supabase = createServiceClient()
  const capacity = getFacilityCapacity(facilityId, loc)
  const windowMs = getWindowMinutes(facilityId, duration) * 60 * 1000

  const found: string[] = []
  const cursor = new Date(afterDate)
  cursor.setMinutes(0, 0, 0)
  cursor.setHours(cursor.getHours() + 1)

  const locConfig = ELKEN_LOCATIONS[loc]
  const [closeH] = locConfig.hours.close.split(':').map(Number)
  const [openH, openM] = locConfig.hours.open.split(':').map(Number)

  let attempts = 0
  while (found.length < maxCount && attempts < 200) {
    attempts++

    if (isOperatingHour(cursor, loc)) {
      const wStart = new Date(cursor.getTime() - windowMs / 2)
      const wEnd = new Date(cursor.getTime() + windowMs / 2)

      const { count: booked } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('bot_id', ELKEN_BOT_ID)
        .eq('metadata->>facility_id', facilityId)
        .eq('metadata->>location_id', loc)
        .in('status', ['pending', 'confirmed', 'trial_pending'])
        .gte('start_time', wStart.toISOString())
        .lt('start_time', wEnd.toISOString())

      if ((booked ?? 0) < capacity) {
        found.push(formatSlotLabel(cursor.toISOString()))
      }
    }

    cursor.setHours(cursor.getHours() + 1)
    if (cursor.getHours() >= closeH) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(openH, openM, 0, 0)
    }
  }

  return found
}
