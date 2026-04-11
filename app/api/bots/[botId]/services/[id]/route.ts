// app/api/bots/[botId]/services/[id]/route.ts — Update and soft-delete a service

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const UpdateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  duration_minutes: z.number().int().min(1).max(1440).optional(),
  buffer_minutes: z.number().int().min(0).max(120).optional(),
  max_simultaneous: z.number().int().min(1).max(100).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  is_active: z.boolean().optional(),
})

// ─── PATCH: update single service ────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = UpdateServiceSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('services')
      .update(parsed.data)
      .eq('id', id)
      .eq('bot_id', botId)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'Service not found' }, { status: 404 })
      }
      throw error
    }

    return Response.json({ service: data })
  } catch (error) {
    console.error('[service PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── DELETE: soft delete (set is_active=false) ────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('services')
      .update({ is_active: false })
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('[service DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
