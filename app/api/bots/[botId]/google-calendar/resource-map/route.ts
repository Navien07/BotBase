// app/api/bots/[botId]/google-calendar/resource-map/route.ts
// GET — return current resource-calendar mapping (google_resource_calendars JSONB)
// PUT — atomically replace resource-calendar mapping

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'

// ─── GET: fetch current mapping ───────────────────────────────────────────────

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
  const { data: bot, error } = await serviceClient
    .from('bots')
    .select('google_resource_calendars')
    .eq('id', botId)
    .single()

  if (error) {
    console.error('[GoogleCalendar:resource-map] bot fetch failed:', error)
    return Response.json({ error: 'Failed to fetch resource map' }, { status: 500 })
  }

  return Response.json({ mapping: bot.google_resource_calendars ?? {} })
}

// ─── PUT: replace mapping atomically ─────────────────────────────────────────

const VALID_RESOURCE_KEYS = z.enum([
  'bed_female_okr',
  'bed_male_okr',
  'room_small_okr',
  'room_large_okr',
  'inhaler_okr',
  'bed_female_subang',
  'bed_male_subang',
  'inhaler_subang',
])

const PutBody = z.object({
  mapping: z.partialRecord(VALID_RESOURCE_KEYS, z.string().min(1)),
})

export async function PUT(
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

  const parsed = PutBody.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('bots')
    .update({
      google_resource_calendars: parsed.data.mapping,
      updated_at: new Date().toISOString(),
    })
    .eq('id', botId)

  if (error) {
    console.error('[GoogleCalendar:resource-map] update failed:', error)
    return Response.json({ error: 'Failed to save resource map' }, { status: 500 })
  }

  return Response.json({ mapping: parsed.data.mapping })
}
