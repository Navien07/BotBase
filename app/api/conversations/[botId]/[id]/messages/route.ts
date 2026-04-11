import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMessage } from '@/lib/channels/dispatcher'

// ─── Validation ────────────────────────────────────────────────────────────────

const MessageSchema = z.object({
  content: z.string().min(1).max(4000),
})

// ─── POST: agent sends message manually ───────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = MessageSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const service = createServiceClient()

    // Verify conversation belongs to this bot
    const { data: conversation } = await service
      .from('conversations')
      .select('id, contact_id')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (!conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Insert agent message
    const { data: message, error: msgErr } = await service
      .from('messages')
      .insert({
        conversation_id: id,
        bot_id: botId,
        role: 'assistant',
        content: parsed.data.content,
        metadata: { sent_by_agent: true, agent_id: user.id },
      })
      .select('id, role, content, metadata, created_at')
      .single()

    if (msgErr) throw msgErr

    // Update last_message_at on conversation (fire and forget)
    ;(async () => {
      await service
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id)
        .eq('bot_id', botId)
    })().catch(console.error)

    // Dispatch to channel (fire and forget)
    if ((conversation as { contact_id: string | null }).contact_id) {
      sendMessage(
        (conversation as { contact_id: string }).contact_id,
        parsed.data.content,
        botId
      ).catch(console.error)
    }

    return Response.json({ message }, { status: 201 })
  } catch (error) {
    console.error('[messages POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
