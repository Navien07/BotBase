import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200).optional().default('New Script'),
  description: z.string().max(500).optional().nullable(),
  trigger_type: z.enum(['keyword', 'intent', 'always', 'manual', 'api']).optional().default('keyword'),
  trigger_value: z.string().max(200).optional().nullable(),
  flow_data: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: scripts, error } = await service
      .from('bot_scripts')
      .select('id, name, description, trigger_type, trigger_value, is_active, version, published_at, created_at, updated_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return Response.json({ scripts: scripts ?? [] })
  } catch (error) {
    console.error('[scripts GET]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

    const service = createServiceClient()
    const { data: script, error } = await service
      .from('bot_scripts')
      .insert({
        bot_id: botId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        trigger_type: parsed.data.trigger_type,
        trigger_value: parsed.data.trigger_value ?? null,
        flow_data: parsed.data.flow_data ?? { nodes: [], edges: [] },
      })
      .select()
      .single()

    if (error) throw error
    return Response.json({ script }, { status: 201 })
  } catch (error) {
    console.error('[scripts POST]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
