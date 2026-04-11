import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Query validation ──────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  status: z.enum(['open', 'closed', 'all']).default('all'),
  channel: z.enum(['all', 'whatsapp', 'telegram', 'web_widget', 'instagram', 'facebook', 'api']).default('all'),
  language: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

interface ConvRow {
  id: string
  last_message_at: string | null
  status: string | null
  agent_id: string | null
  channel: string
  language: string
  created_at: string
  contact_id: string | null
  contacts: { id: string; name: string | null; phone: string | null; channel: string } | null
}

interface MsgRow {
  conversation_id: string
  role: string
  content: string
}

// ─── GET: list conversations ───────────────────────────────────────────────────

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
    const parsed = ListQuerySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return Response.json({ error: 'Invalid query parameters' }, { status: 400 })
    }
    const { status, channel, language, search, page, limit } = parsed.data
    const offset = (page - 1) * limit

    const service = createServiceClient()

    // If searching, resolve contact IDs first to avoid nested relation filter complexity
    let contactIdFilter: string[] | null = null
    if (search) {
      const { data: matched } = await service
        .from('contacts')
        .select('id')
        .eq('bot_id', botId)
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(200)
      const matchedRows = (matched as unknown as Array<{ id: string }>) ?? []
      contactIdFilter = matchedRows.map(c => c.id)
      if (contactIdFilter.length === 0) {
        return Response.json({ conversations: [], total: 0, page, limit })
      }
    }

    // Build conversations query
    let q = service
      .from('conversations')
      .select(
        'id, last_message_at, status, agent_id, channel, language, created_at, contact_id,' +
        'contacts(id, name, phone, channel)',
        { count: 'exact' }
      )
      .eq('bot_id', botId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (status !== 'all') q = q.eq('status', status)
    if (channel !== 'all') q = q.eq('channel', channel)
    if (language) q = q.eq('language', language)
    if (contactIdFilter) q = q.in('contact_id', contactIdFilter)

    const { data: rawConversations, error, count } = await q
    if (error) throw error

    const conversations = (rawConversations as unknown as ConvRow[]) ?? []

    // Fetch last message per conversation (single query, pick first per convo)
    const ids = conversations.map(c => c.id)
    const lastMsgMap: Record<string, { role: string; content: string }> = {}

    if (ids.length > 0) {
      const { data: rawMsgs } = await service
        .from('messages')
        .select('conversation_id, role, content')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(ids.length * 5)

      const msgs = (rawMsgs as unknown as MsgRow[]) ?? []
      const seen = new Set<string>()
      for (const m of msgs) {
        if (!seen.has(m.conversation_id)) {
          seen.add(m.conversation_id)
          lastMsgMap[m.conversation_id] = { role: m.role, content: m.content.slice(0, 50) }
        }
      }
    }

    const result = conversations.map(conv => ({
      id: conv.id,
      last_message_at: conv.last_message_at,
      status: conv.status ?? 'open',
      agent_id: conv.agent_id,
      channel: conv.channel,
      language: conv.language,
      created_at: conv.created_at,
      contact: conv.contacts ?? null,
      last_message: lastMsgMap[conv.id] ?? null,
      unread_count: 0,
    }))

    return Response.json({ conversations: result, total: count ?? 0, page, limit })
  } catch (error) {
    console.error('[conversations/[botId] GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
