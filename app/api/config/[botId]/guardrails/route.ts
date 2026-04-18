import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'

// ─── GET: return guardrail fields ──────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId)
  if (accessCheck instanceof Response) return accessCheck

  try {
    const { data, error } = await createServiceClient()
      .from('bots')
      .select(
        'guardrail_rules, keyword_blocklist, ' +
        'fact_grounding, hallucination_guard, ' +
        'response_min_words, response_max_words'
      )
      .eq('id', botId)
      .single()

    if (error) throw error
    if (!data) return Response.json({ error: 'Bot not found' }, { status: 404 })

    return Response.json({ guardrails: data })
  } catch (error) {
    console.error('[guardrails GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── Validation schema ─────────────────────────────────────────────────────────

const GuardrailsSchema = z.object({
  guardrail_rules: z.object({
    in_scope: z.array(z.string()),
    out_of_scope: z.array(z.string()),
    important: z.array(z.string()),
  }),
  keyword_blocklist: z.array(z.string()),
  fact_grounding: z.boolean(),
  hallucination_guard: z.boolean(),
  response_min_words: z.number().int().min(0).max(100),
  response_max_words: z.number().int().min(50).max(500),
})

// ─── PUT: update guardrail fields ─────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId)
  if (accessCheck instanceof Response) return accessCheck

  try {
    const body = await req.json()
    const parsed = GuardrailsSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('bots')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', botId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[guardrails PUT]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
