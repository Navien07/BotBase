import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/security/rate-limit'

const ContactCreateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  channel: z.string().default('manual'),
  language: z.string().default('en'),
  tags: z.array(z.string()).default([]),
  lead_stage: z
    .enum(['new', 'engaged', 'qualified', 'booked', 'converted', 'churned'])
    .default('new'),
  notes: z.string().max(5000).optional(),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const allowed = await rateLimit(`contacts:${ip}`, { max: 120, windowMs: 60000 })
  if (!allowed) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const { searchParams } = req.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
    const offset = (page - 1) * limit
    const search = searchParams.get('search') ?? ''
    const lead_stage = searchParams.get('lead_stage') ?? ''
    const language = searchParams.get('language') ?? ''
    const channel = searchParams.get('channel') ?? ''
    const tag = searchParams.get('tag') ?? ''
    const sort = searchParams.get('sort') ?? 'created_at'
    const order = searchParams.get('order') === 'asc'

    const ALLOWED_SORT = ['name', 'lead_stage', 'lead_score', 'last_message_at', 'created_at', 'total_messages']
    const sortField = ALLOWED_SORT.includes(sort) ? sort : 'created_at'

    const supabase = createServiceClient()

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('bot_id', botId)
      .order(sortField, { ascending: order })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
      )
    }
    if (lead_stage) query = query.eq('lead_stage', lead_stage)
    if (language) query = query.eq('language', language)
    if (channel) query = query.eq('channel', channel)
    if (tag) query = query.contains('tags', [tag])

    const { data, count, error } = await query

    if (error) throw error

    return Response.json({
      contacts: data ?? [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    })
  } catch (error) {
    console.error('[contacts GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  try {
    const body = await req.json()
    const parsed = ContactCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues }, { status: 400 })
    }

    const { name, phone, email, channel, language, tags, lead_stage, notes, custom_fields } =
      parsed.data

    if (!phone && !email) {
      return Response.json({ error: 'phone or email is required' }, { status: 400 })
    }

    const external_id = phone || email || `manual-${Date.now()}`
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('contacts')
      .upsert(
        {
          bot_id: botId,
          external_id,
          channel,
          name: name ?? null,
          phone: phone ?? null,
          email: email ?? null,
          language,
          tags,
          lead_stage,
          notes: notes ?? null,
          custom_fields,
        },
        { onConflict: 'bot_id,external_id,channel', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) throw error

    return Response.json({ contact: data }, { status: 201 })
  } catch (error) {
    console.error('[contacts POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
