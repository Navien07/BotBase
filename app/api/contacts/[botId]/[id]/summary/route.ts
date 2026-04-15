import { createServiceClient } from '@/lib/supabase/service'
import { anthropic } from '@/lib/anthropic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  if (!botId || !id) return Response.json({ error: 'Missing params' }, { status: 400 })

  try {
    const supabase = createServiceClient()

    // Get contact's conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', id)
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!conversations || conversations.length === 0) {
      return Response.json({ summary: null })
    }

    const convIds = conversations.map(c => c.id)

    // Fetch last 30 user messages across those conversations
    const { data: messages } = await supabase
      .from('messages')
      .select('content, intent, created_at')
      .in('conversation_id', convIds)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(30)

    if (!messages || messages.length === 0) {
      return Response.json({ summary: null })
    }

    const transcript = messages
      .reverse()
      .map(m => `- ${m.content.slice(0, 200)}`)
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are a CRM assistant. Given a list of user messages, write a 1-2 sentence summary of:
1. What topics/services they inquired about
2. Any clear buying intent or specific needs
Be concise and factual. Do not speculate. Output plain text only.`,
      messages: [{ role: 'user', content: `User messages:\n${transcript}` }],
    })

    const summary = anthropic.getTextContent(response).trim()
    return Response.json({ summary: summary || null })
  } catch (error) {
    console.error('[contacts/[id]/summary GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
