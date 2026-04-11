import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit/logger'

// ─── POST: start agent takeover ───────────────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const service = createServiceClient()

    // End any existing active sessions for this conversation
    await service
      .from('agent_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .eq('is_active', true)

    // Create new agent session
    const { data: session, error: sessionErr } = await service
      .from('agent_sessions')
      .insert({
        conversation_id: id,
        agent_id: user.id,
        bot_id: botId,
        is_active: true,
      })
      .select('id, agent_id, started_at, is_active')
      .single()

    if (sessionErr) throw sessionErr

    // Update conversation: assign agent + ensure open status
    await service
      .from('conversations')
      .update({ agent_id: user.id, status: 'open' })
      .eq('id', id)
      .eq('bot_id', botId)

    logAudit({
      action: 'agent_takeover_started',
      botId,
      userId: user.id,
      metadata: { conversation_id: id, session_id: session.id },
    }).catch(console.error)

    return Response.json({ session }, { status: 201 })
  } catch (error) {
    console.error('[takeover POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── DELETE: end agent takeover ───────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const service = createServiceClient()

    // End active session for this agent
    await service
      .from('agent_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .eq('agent_id', user.id)
      .eq('is_active', true)

    // Clear agent_id from conversation so bot resumes
    await service
      .from('conversations')
      .update({ agent_id: null })
      .eq('id', id)
      .eq('bot_id', botId)

    logAudit({
      action: 'agent_takeover_ended',
      botId,
      userId: user.id,
      metadata: { conversation_id: id },
    }).catch(console.error)

    return Response.json({ success: true })
  } catch (error) {
    console.error('[takeover DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
