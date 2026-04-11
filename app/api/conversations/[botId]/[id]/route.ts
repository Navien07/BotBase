import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Validation ────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  agent_id: z.string().uuid().nullable().optional(),
})

// ─── GET: full conversation with messages ─────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const service = createServiceClient()

    const { data: conversation, error: convErr } = await service
      .from('conversations')
      .select('*, contacts(id, name, phone, email, channel, language, lead_stage, tags)')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (convErr || !conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { data: messages, error: msgErr } = await service
      .from('messages')
      .select('id, role, content, intent, language, rag_found, sentiment, pipeline_debug, metadata, created_at')
      .eq('conversation_id', id)
      .eq('bot_id', botId)
      .order('created_at', { ascending: true })

    if (msgErr) throw msgErr

    // Get active agent session if any
    const { data: agentSession } = await service
      .from('agent_sessions')
      .select('id, agent_id, started_at, is_active')
      .eq('conversation_id', id)
      .eq('is_active', true)
      .maybeSingle()

    return Response.json({
      conversation,
      messages: messages ?? [],
      agent_session: agentSession ?? null,
    })
  } catch (error) {
    console.error('[conversations/[id] GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PATCH: update status / agent_id ─────────────────────────────────────────

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
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.agent_id !== undefined) updates.agent_id = parsed.data.agent_id

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await createServiceClient()
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[conversations/[id] PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
