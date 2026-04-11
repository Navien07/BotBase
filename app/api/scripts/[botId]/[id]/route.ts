import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  trigger_type: z.enum(['keyword', 'intent', 'always', 'manual', 'api']).optional(),
  trigger_value: z.string().max(200).nullable().optional(),
  flow_data: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: script, error } = await service
      .from('bot_scripts')
      .select('*')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (error || !script) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ script })
  } catch (error) {
    console.error('[script GET]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

    const service = createServiceClient()
    const { data: script, error } = await service
      .from('bot_scripts')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('bot_id', botId)
      .select()
      .single()

    if (error || !script) return Response.json({ error: 'Not found or update failed' }, { status: 404 })
    return Response.json({ script })
  } catch (error) {
    console.error('[script PATCH]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { error } = await service
      .from('bot_scripts')
      .delete()
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error
    return Response.json({ success: true })
  } catch (error) {
    console.error('[script DELETE]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
