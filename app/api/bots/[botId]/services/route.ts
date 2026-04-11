// app/api/bots/[botId]/services/route.ts — List, create, and upsert all services

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  duration_minutes: z.number().int().min(1).max(1440).default(60),
  buffer_minutes: z.number().int().min(0).max(120).default(0),
  max_simultaneous: z.number().int().min(1).max(100).default(1),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).default('MYR'),
  is_active: z.boolean().default(true),
})

const UpsertServicesSchema = z.array(ServiceSchema)

// ─── GET: list services ───────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const all = url.searchParams.get('all') === 'true'

    const serviceClient = createServiceClient()
    let query = serviceClient
      .from('services')
      .select('*')
      .eq('bot_id', botId)
      .order('name', { ascending: true })

    if (!all) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error

    return Response.json({ services: data ?? [] })
  } catch (error) {
    console.error('[services GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST: create service ─────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = ServiceSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('services')
      .insert({ bot_id: botId, ...parsed.data })
      .select('*')
      .single()

    if (error) throw error

    return Response.json({ service: data }, { status: 201 })
  } catch (error) {
    console.error('[services POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PUT: upsert entire service catalogue ────────────────────────────────────

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
    const parsed = UpsertServicesSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Soft-delete all existing services, then insert fresh catalogue
    await serviceClient
      .from('services')
      .update({ is_active: false })
      .eq('bot_id', botId)

    if (parsed.data.length > 0) {
      const rows = parsed.data.map((s) => ({ bot_id: botId, ...s }))
      const { error } = await serviceClient.from('services').insert(rows)
      if (error) throw error
    }

    const { data: services } = await serviceClient
      .from('services')
      .select('*')
      .eq('bot_id', botId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    return Response.json({ services: services ?? [] })
  } catch (error) {
    console.error('[services PUT]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
