import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── POST: create a new bot ───────────────────────────────────────────────────

const CreateBotSchema = z.object({
  name: z.string().min(1).max(100),
  industry: z.string().min(1).max(100).optional(),
  default_language: z.enum(['en', 'bm', 'zh']).default('en'),
  personality_preset: z.enum(['friendly', 'professional', 'enthusiastic']).default('friendly'),
  tenant_id: z.string().uuid().optional(),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

// ─── GET: list bots ───────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) return Response.json({ bots: [] })

    let query = serviceClient
      .from('bots')
      .select('id, name, slug, is_active, default_language, created_at, tenant_id, tenants(name)')
      .order('created_at', { ascending: false })

    if (profile.role !== 'super_admin') {
      if (!profile.tenant_id) return Response.json({ bots: [] })
      query = query.eq('tenant_id', profile.tenant_id)
    }

    const { data: bots, error } = await query
    if (error) throw error

    return Response.json({ bots: bots ?? [] })
  } catch (error) {
    console.error('[bots GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST: create bot ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateBotSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, industry, default_language, personality_preset, tenant_id: bodyTenantId } = parsed.data

  try {
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    let tenantId: string

    if (profile?.role === 'super_admin') {
      if (!bodyTenantId) {
        return Response.json({ error: 'tenant_id is required for super_admin' }, { status: 400 })
      }
      tenantId = bodyTenantId
    } else {
      if (!profile?.tenant_id) {
        return Response.json({ error: 'No tenant found for this user' }, { status: 400 })
      }
      tenantId = profile.tenant_id
    }

    // Generate unique slug
    const baseSlug = slugify(name) || 'bot'
    const suffix = Math.random().toString(36).slice(2, 7)
    const slug = `${baseSlug}-${suffix}`

    const SYSTEM_PROMPT_DEFAULTS: Record<string, string> = {
      friendly: 'You are a friendly and helpful AI assistant. Be warm, approachable, and supportive in every interaction.',
      professional: 'You are a professional AI assistant. Maintain a formal, precise, and knowledgeable tone at all times.',
      enthusiastic: 'You are an energetic and enthusiastic AI assistant. Be upbeat, encouraging, and positive in every interaction.',
    }

    const { data: bot, error } = await serviceClient
      .from('bots')
      .insert({
        tenant_id: tenantId,
        name,
        bot_name: name,
        slug,
        default_language,
        personality_preset: personality_preset === 'enthusiastic' ? 'friendly' : personality_preset,
        system_prompt: SYSTEM_PROMPT_DEFAULTS[personality_preset],
        is_active: false,
        timezone: 'Asia/Kuala_Lumpur',
        rag_threshold: 0.55,
        feature_flags: {
          booking_enabled: false,
          booking_type: 'appointment',
          crm_enabled: true,
          broadcasts_enabled: false,
          flow_builder_enabled: false,
          pdf_delivery_enabled: false,
          widget_enabled: true,
          voice_enabled: false,
        },
        guardrail_rules: { in_scope: [], out_of_scope: [], important: [] },
        fact_grounding: true,
        hallucination_guard: true,
        response_min_words: 10,
        response_max_words: 300,
        keyword_blocklist: [],
        fallback_message: "I'm sorry, I can only help with questions related to our business.",
        greeting_en: 'Hi! How can I help you today? 😊',
        greeting_bm: 'Hai! Bagaimana saya boleh membantu anda hari ini? 😊',
        ...(industry ? { system_prompt: SYSTEM_PROMPT_DEFAULTS[personality_preset] } : {}),
      })
      .select('id, name, slug, tenant_id, is_active, default_language, personality_preset')
      .single()

    if (error) throw error
    if (!bot) throw new Error('Bot creation returned no data')

    return Response.json({ bot }, { status: 201 })
  } catch (error) {
    console.error('[bots POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
