import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── GET: return progress for auth user's tenant ──────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return Response.json({ current_step: 'create_bot', steps_completed: [] })
    }

    const { data: progress } = await serviceClient
      .from('onboarding_progress')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (!progress) {
      return Response.json({ current_step: 'create_bot', steps_completed: [] })
    }

    return Response.json(progress)
  } catch (error) {
    console.error('[onboarding/progress GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PUT: upsert progress ─────────────────────────────────────────────────────

const PutSchema = z.object({
  step: z.string().min(1).max(50),
  botId: z.string().uuid().optional(),
  completed: z.boolean().optional(),
})

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { step, botId, completed } = parsed.data

  try {
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return Response.json({ error: 'No tenant found' }, { status: 400 })
    }

    // Fetch existing to merge steps_completed
    const { data: existing } = await serviceClient
      .from('onboarding_progress')
      .select('steps_completed')
      .eq('tenant_id', profile.tenant_id)
      .single()

    const existingSteps: string[] = (existing?.steps_completed as string[]) ?? []
    const steps_completed = existingSteps.includes(step)
      ? existingSteps
      : [...existingSteps, step]

    const upsertData: Record<string, unknown> = {
      tenant_id: profile.tenant_id,
      current_step: step,
      steps_completed,
      updated_at: new Date().toISOString(),
    }

    if (botId) upsertData.bot_id = botId
    if (completed) upsertData.completed_at = new Date().toISOString()

    const { data: progress, error } = await serviceClient
      .from('onboarding_progress')
      .upsert(upsertData, { onConflict: 'tenant_id' })
      .select()
      .single()

    if (error) throw error

    return Response.json(progress)
  } catch (error) {
    console.error('[onboarding/progress PUT]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
