import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const RatingSchema = z.object({
  messageId: z.string().uuid(),
  sessionId: z.string().min(1).max(128),
  rating: z.enum(['positive', 'negative']),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400, headers: CORS_HEADERS })
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS })
    }

    const parsed = RatingSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400, headers: CORS_HEADERS })
    }

    const { messageId, sessionId, rating } = parsed.data
    const externalUserId = `widget:${sessionId}`

    const supabase = createServiceClient()

    // Verify the message belongs to a conversation in this bot + session
    const { data: message } = await supabase
      .from('messages')
      .select('id, conversation_id, conversations!inner(bot_id, external_user_id)')
      .eq('id', messageId)
      .eq('conversations.bot_id', botId)
      .eq('conversations.external_user_id', externalUserId)
      .single()

    if (!message) {
      return Response.json({ error: 'Message not found' }, { status: 404, headers: CORS_HEADERS })
    }

    const { error } = await supabase
      .from('messages')
      .update({ user_rating: rating })
      .eq('id', messageId)

    if (error) throw error

    return Response.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('[widget/rating POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
