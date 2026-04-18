import { anthropic } from '@/lib/anthropic'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireBotAccess } from '@/lib/auth/require-bot-access'

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

  const accessCheck = await requireBotAccess(user.id, botId)
  if (accessCheck instanceof Response) return accessCheck

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
