// app/api/bots/[botId]/operating-hours/route.ts — Get and upsert operating hours (7 rows)

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const HourRowSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  open_time: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  close_time: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  lunch_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  lunch_end: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
})

const UpsertHoursSchema = z.array(HourRowSchema).length(7)

// ─── GET: all 7 rows ──────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('operating_hours')
      .select('*')
      .eq('bot_id', botId)
      .order('day_of_week', { ascending: true })

    if (error) throw error

    return Response.json({ hours: data ?? [] })
  } catch (error) {
    console.error('[operating-hours GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PUT: upsert all 7 rows ───────────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = UpsertHoursSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input — must be array of 7 day rows', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const rows = parsed.data.map((row) => ({ bot_id: botId, ...row }))

    const { data, error } = await serviceClient
      .from('operating_hours')
      .upsert(rows, { onConflict: 'bot_id,day_of_week' })
      .select('*')
      .order('day_of_week', { ascending: true })

    if (error) throw error

    return Response.json({ hours: data ?? [] })
  } catch (error) {
    console.error('[operating-hours PUT]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
