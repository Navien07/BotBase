import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const GenerateSchema = z.object({
  botDescription: z.string().min(10).max(1000),
  industry: z.string().min(2).max(100),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  await params // await required by App Router

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = GenerateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { botDescription, industry } = parsed.data

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are an expert at writing AI assistant system prompts for businesses. Generate a professional system prompt for a chatbot.',
      messages: [
        {
          role: 'user',
          content: `Business: ${botDescription}. Industry: ${industry}. Write a concise, effective system prompt (max 500 words). Return only the system prompt text, no preamble.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return Response.json({ error: 'Unexpected response from AI' }, { status: 500 })
    }

    return Response.json({ systemPrompt: content.text })
  } catch (error) {
    console.error('[personality/generate POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
