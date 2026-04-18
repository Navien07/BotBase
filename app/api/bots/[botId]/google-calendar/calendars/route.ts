// app/api/bots/[botId]/google-calendar/calendars/route.ts
// GET  — list user's Google Calendars (calendarList.list)
// POST — create a new Google Calendar (calendars.insert)

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'
import { getValidAccessToken } from '@/lib/booking/token-manager'
import type { Bot } from '@/types/database'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// ─── GET: list calendars ──────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  const serviceClient = createServiceClient()
  const { data: bot } = await serviceClient
    .from('bots')
    .select('id, google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', botId)
    .single()

  if (!bot?.google_access_token) {
    return Response.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  const token = await getValidAccessToken(bot as unknown as Bot)
  if (!token) {
    return Response.json({ error: 'Failed to get valid Google access token' }, { status: 500 })
  }

  const res = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[GoogleCalendar:calendars] list failed:', res.status, body)
    return Response.json({ error: 'Failed to fetch calendars from Google' }, { status: 500 })
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: string
      summary: string
      primary?: boolean
      accessRole: string
    }>
  }

  const calendars = (data.items ?? [])
    .map(({ id, summary, primary, accessRole }) => ({
      id,
      summary,
      primary: primary ?? false,
      accessRole,
    }))
    .sort((a, b) => {
      if (a.primary && !b.primary) return -1
      if (!a.primary && b.primary) return 1
      return a.summary.localeCompare(b.summary)
    })

  return Response.json({ calendars })
}

// ─── POST: create calendar ────────────────────────────────────────────────────

const PostBody = z.object({
  name: z.string().min(1).max(200),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PostBody.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data: bot } = await serviceClient
    .from('bots')
    .select('id, google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', botId)
    .single()

  if (!bot?.google_access_token) {
    return Response.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  const token = await getValidAccessToken(bot as unknown as Bot)
  if (!token) {
    return Response.json({ error: 'Failed to get valid Google access token' }, { status: 500 })
  }

  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary: parsed.data.name, timeZone: 'Asia/Kuala_Lumpur' }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error('[GoogleCalendar:calendars] create failed:', res.status, errBody)
    return Response.json({ error: 'Failed to create calendar' }, { status: 500 })
  }

  const created = (await res.json()) as { id: string; summary: string }
  return Response.json({ id: created.id, summary: created.summary }, { status: 201 })
}
