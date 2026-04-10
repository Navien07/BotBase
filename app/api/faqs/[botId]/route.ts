import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { embedQuery } from '@/lib/ingest/embedder'

// ─── Validation schema ─────────────────────────────────────────────────────────

const FaqCreateSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(2000),
  language: z.enum(['en', 'bm', 'zh']),
})

// ─── GET: list FAQs with optional language filter ──────────────────────────────

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

    let query = supabase
      .from('faqs')
      .select('id, question, answer, language, is_active, created_at, updated_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    if (language && language !== 'all') query = query.eq('language', language)

    const { data, error } = await query
    if (error) throw error

    return Response.json({ faqs: data ?? [] })
  } catch (error) {
    console.error('[faqs GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST: create FAQ with embedding ──────────────────────────────────────────

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
    const parsed = FaqCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    // Embed the answer for semantic search
    const embedding = await embedQuery(parsed.data.answer)

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('faqs')
      .insert({
        bot_id: botId,
        question: parsed.data.question,
        answer: parsed.data.answer,
        language: parsed.data.language,
        embedding,
        is_active: true,
      })
      .select('id, question, answer, language, is_active, created_at, updated_at')
      .single()

    if (error) throw error

    return Response.json({ faq: data }, { status: 201 })
  } catch (error) {
    console.error('[faqs POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
