import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface DbConversation {
  id: string
  external_user_id: string
  created_at: string
}

interface DbMessage {
  conversation_id: string
  role: string
  content: string
}

// ─── GET /api/test-sessions/[botId] ───────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const service = createServiceClient()

    const { data: sessions, error } = await service
      .from('conversations')
      .select('id, external_user_id, created_at')
      .eq('bot_id', botId)
      .eq('channel', 'testing')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const rows = (sessions ?? []) as DbConversation[]

    if (rows.length === 0) {
      return Response.json({ sessions: [] })
    }

    // Fetch messages for all sessions in one query
    const sessionIds = rows.map((s) => s.id)
    const { data: messages } = await service
      .from('messages')
      .select('conversation_id, role, content')
      .in('conversation_id', sessionIds)
      .order('created_at', { ascending: false })

    const msgRows = (messages ?? []) as DbMessage[]

    // Build per-conversation counts + last user message
    const countMap: Record<string, number> = {}
    const lastMsgMap: Record<string, string> = {}

    for (const m of msgRows) {
      countMap[m.conversation_id] = (countMap[m.conversation_id] ?? 0) + 1
      if (!lastMsgMap[m.conversation_id] && m.role === 'user') {
        lastMsgMap[m.conversation_id] = m.content
      }
    }

    const result = rows.map((s) => ({
      id: s.id,
      sessionId: s.external_user_id,
      createdAt: s.created_at,
      messageCount: countMap[s.id] ?? 0,
      lastMessage: lastMsgMap[s.id] ?? null,
    }))

    return Response.json({ sessions: result })
  } catch (error) {
    console.error('[test-sessions GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
