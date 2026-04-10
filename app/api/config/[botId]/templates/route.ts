import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Validation schema ─────────────────────────────────────────────────────────

const TemplateSchema = z.object({
  intent: z.string().min(1).max(100),
  language: z.enum(['en', 'bm', 'zh']),
  content: z.string().min(1).max(2000),
  format: z.enum(['text', 'bullet_list', 'numbered_list', 'card']),
})

// ─── GET: list templates for a bot ────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const language = searchParams.get('language')

    const service = createServiceClient()
    let query = service
      .from('response_templates')
      .select('id, intent, language, content, format, created_at, updated_at')
      .eq('bot_id', botId)
      .order('intent', { ascending: true })

    if (language) query = query.eq('language', language)

    const { data, error } = await query
    if (error) throw error

    return Response.json({ templates: data ?? [] })
  } catch (error) {
    console.error('[templates GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST: upsert template by intent + language ────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = TemplateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('response_templates')
      .upsert(
        {
          bot_id: botId,
          intent: parsed.data.intent,
          language: parsed.data.language,
          content: parsed.data.content,
          format: parsed.data.format,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'bot_id,intent,language' }
      )
      .select('id, intent, language, content, format, updated_at')
      .single()

    if (error) throw error

    return Response.json({ template: data })
  } catch (error) {
    console.error('[templates POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
