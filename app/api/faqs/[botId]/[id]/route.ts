import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { embedQuery } from '@/lib/ingest/embedder'

// ─── Validation schema ─────────────────────────────────────────────────────────

const FaqPatchSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(2000).optional(),
  language: z.enum(['en', 'bm', 'zh']).optional(),
  is_active: z.boolean().optional(),
})

// ─── PATCH: update FAQ, re-embed answer if changed ────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as unknown
    const parsed = FaqPatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    }

    // Re-embed answer whenever it changes
    if (parsed.data.answer) {
      updates.embedding = await embedQuery(parsed.data.answer)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('faqs')
      .update(updates)
      .eq('id', id)
      .eq('bot_id', botId)
      .select('id, question, answer, language, is_active, created_at, updated_at')
      .single()

    if (error) throw error
    if (!data) return Response.json({ error: 'FAQ not found' }, { status: 404 })

    return Response.json({ faq: data })
  } catch (error) {
    console.error('[faqs PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── DELETE: hard delete ───────────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('faqs')
      .delete()
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[faqs DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
