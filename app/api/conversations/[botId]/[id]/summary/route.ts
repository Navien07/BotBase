import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { anthropic } from '@/lib/anthropic'

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

    const { data: messages } = await service
      .from('messages')
      .select('role, content')
      .eq('conversation_id', id)
      .eq('bot_id', botId)
      .order('created_at', { ascending: true })
      .limit(30)

    if (!messages || messages.length < 2) {
      return Response.json({ summary: 'Not enough messages to summarize yet.' })
    }

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Bot'}: ${String(m.content).slice(0, 300)}`)
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Summarize this customer conversation in one sentence (max 20 words):\n\n${transcript}`,
      }],
    })

    const summary = anthropic.getTextContent(response)
    return Response.json({ summary })
  } catch (error) {
    console.error('[conversations/summary GET]', error)
    return Response.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
