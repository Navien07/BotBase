// lib/booking/google-calendar.ts — Google Calendar sync for booking events

import { getValidAccessToken } from '@/lib/booking/token-manager'
import type { Booking, Bot } from '@/types/database'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export async function createCalendarEvent(
  booking: Booking,
  bot: Bot
): Promise<string | null> {
  console.log('[GoogleCalendar] createCalendarEvent START bookingId=', booking.id, 'botId=', bot.id)

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[GoogleCalendar] SKIP — GOOGLE env vars missing')
    return null
  }
  if (!bot.google_access_token) {
    console.warn('[GoogleCalendar] SKIP — no google_access_token on bot', bot.id)
    return null
  }

  try {
    const token = await getValidAccessToken(bot)
    if (!token) {
      console.error('[GoogleCalendar] SKIP — getValidAccessToken returned null for bot', bot.id)
      return null
    }
    console.log('[GoogleCalendar] token obtained, calling Calendar API')

    const endTime =
      booking.end_time ??
      new Date(new Date(booking.start_time).getTime() + 60 * 60_000).toISOString()

    const event = {
      summary: `${booking.service_name ?? 'Booking'} — ${booking.customer_name ?? 'Customer'}`,
      description: [
        booking.customer_phone ? `Phone: ${booking.customer_phone}` : '',
        booking.customer_email ? `Email: ${booking.customer_email}` : '',
        booking.special_requests ? `Notes: ${booking.special_requests}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      start: { dateTime: booking.start_time, timeZone: 'Asia/Kuala_Lumpur' },
      end: { dateTime: endTime, timeZone: 'Asia/Kuala_Lumpur' },
      attendees: booking.customer_email ? [{ email: booking.customer_email }] : [],
    }

    // Resolve calendarId from resource mapping (Commit 3b Chunk B)
    const facilityId = (booking.metadata as Record<string, unknown>)?.facility_id as string | undefined
    const locationId = (booking.metadata as Record<string, unknown>)?.location_id as string | undefined
    const resourceKey = facilityId && locationId ? `${facilityId}_${locationId}` : null
    const resourceMap = (bot.google_resource_calendars ?? {}) as Record<string, string>
    const calendarId = (resourceKey && resourceMap[resourceKey]) ? resourceMap[resourceKey] : 'primary'

    const res = await fetch(`${CALENDAR_API}/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[GoogleCalendar] Calendar API non-ok:', res.status, errBody)
      return null
    }

    const data = (await res.json()) as { id?: string }
    console.log('[GoogleCalendar] event created:', data.id, 'bookingId=', booking.id)
    return data.id ?? null
  } catch (err) {
    console.error('[GoogleCalendar] createCalendarEvent threw:', err)
    return null
  }
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<Booking>,
  bot: Bot
): Promise<void> {
  console.log('[GoogleCalendar] updateCalendarEvent START eventId=', eventId, 'botId=', bot.id)

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[GoogleCalendar] SKIP update — GOOGLE env vars missing')
    return
  }
  if (!bot.google_access_token) {
    console.warn('[GoogleCalendar] SKIP update — no google_access_token on bot', bot.id)
    return
  }

  try {
    const token = await getValidAccessToken(bot)
    if (!token) {
      console.error('[GoogleCalendar] SKIP update — getValidAccessToken returned null for bot', bot.id)
      return
    }

    // TODO(Issue 4): update/delete still targets 'primary' calendar.
    // If event was created on a mapped resource calendar, this will silently
    // fail. Fix when booking row stores google_calendar_id (Issue 4 refactor).
    console.warn('[GoogleCalendar] update/delete targets primary calendar — mapped resource calendar not supported until Issue 4 refactor')

    const patch: Record<string, unknown> = {}

    if (updates.start_time) {
      patch.start = { dateTime: updates.start_time, timeZone: 'Asia/Kuala_Lumpur' }
    }
    if (updates.end_time) {
      patch.end = { dateTime: updates.end_time, timeZone: 'Asia/Kuala_Lumpur' }
    }
    if (updates.service_name || updates.customer_name) {
      patch.summary = `${updates.service_name ?? ''} — ${updates.customer_name ?? 'Customer'}`.trim()
    }

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[GoogleCalendar] update non-ok:', res.status, errBody)
      return
    }

    console.log('[GoogleCalendar] event updated:', eventId)
  } catch (err) {
    console.error('[GoogleCalendar] updateCalendarEvent threw:', err)
  }
}

export async function deleteCalendarEvent(eventId: string, bot: Bot): Promise<void> {
  console.log('[GoogleCalendar] deleteCalendarEvent START eventId=', eventId, 'botId=', bot.id)

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[GoogleCalendar] SKIP delete — GOOGLE env vars missing')
    return
  }
  if (!bot.google_access_token) {
    console.warn('[GoogleCalendar] SKIP delete — no google_access_token on bot', bot.id)
    return
  }

  try {
    const token = await getValidAccessToken(bot)
    if (!token) {
      console.error('[GoogleCalendar] SKIP delete — getValidAccessToken returned null for bot', bot.id)
      return
    }

    // TODO(Issue 4): update/delete still targets 'primary' calendar.
    // If event was created on a mapped resource calendar, this will silently
    // fail. Fix when booking row stores google_calendar_id (Issue 4 refactor).
    console.warn('[GoogleCalendar] update/delete targets primary calendar — mapped resource calendar not supported until Issue 4 refactor')

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok && res.status !== 410) {
      // 410 Gone = already deleted, treat as success
      const errBody = await res.text()
      console.error('[GoogleCalendar] delete non-ok:', res.status, errBody)
      return
    }

    console.log('[GoogleCalendar] event deleted:', eventId)
  } catch (err) {
    console.error('[GoogleCalendar] deleteCalendarEvent threw:', err)
  }
}
