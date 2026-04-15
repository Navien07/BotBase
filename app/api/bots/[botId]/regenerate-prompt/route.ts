import { anthropic } from '@/lib/anthropic'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 30

const BodySchema = z.object({
  industry: z.string().min(1).max(100),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { industry } = parsed.data

  try {
    // Verify bot belongs to user's tenant
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return Response.json({ error: 'No tenant found' }, { status: 400 })
    }

    const { data: bot } = await serviceClient
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (!bot) return Response.json({ error: 'Bot not found' }, { status: 404 })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: 'You write concise AI chatbot system prompts.',
            messages: [
              {
                role: 'user',
                content: `Write a system prompt for a ${industry} business chatbot. Max 150 words. Return only the prompt text, no preamble or explanation.`,
              },
            ],
          })) {
            controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('[bots/regenerate-prompt POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
