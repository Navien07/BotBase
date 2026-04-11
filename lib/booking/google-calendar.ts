// lib/booking/google-calendar.ts — Google Calendar sync for booking events

import type { Booking, Bot } from '@/types/database'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export async function createCalendarEvent(
  booking: Booking,
  bot: Bot
): Promise<string | null> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null
  if (!bot.google_access_token) return null

  try {
    const token = await getValidToken(bot)
    if (!token) return null

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

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return data.id ?? null
  } catch {
    return null
  }
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<Booking>,
  bot: Bot
): Promise<void> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return
  if (!bot.google_access_token) return

  try {
    const token = await getValidToken(bot)
    if (!token) return

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

    await fetch(`${CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    })
  } catch {
    // silently fail — calendar sync is best-effort
  }
}

export async function deleteCalendarEvent(eventId: string, bot: Bot): Promise<void> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return
  if (!bot.google_access_token) return

  try {
    const token = await getValidToken(bot)
    if (!token) return

    await fetch(`${CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // silently fail
  }
}

// ─── Token management ─────────────────────────────────────────────────────────

async function getValidToken(bot: Bot): Promise<string | null> {
  if (!bot.google_access_token) return null

  // If expiry is more than 60s away, token is still valid
  if (bot.google_token_expiry) {
    const expiry = new Date(bot.google_token_expiry)
    if (expiry.getTime() > Date.now() + 60_000) {
      return bot.google_access_token
    }
  } else {
    // No expiry stored — assume valid
    return bot.google_access_token
  }

  // Token expired — refresh
  if (!bot.google_refresh_token) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: bot.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) return null
    const data = (await res.json()) as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}
