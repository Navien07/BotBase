import { z } from 'zod'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/audit/logger'

// ─── Validation ────────────────────────────────────────────────────────────────

const CreateKeySchema = z.object({
  label: z.string().min(1).max(100),
})

// ─── GET: list api keys for botId ─────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, label, key_prefix, last_used_at, created_at, revoked_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({ keys: data ?? [] })
  } catch (error) {
    console.error('[api-keys GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST: generate new api key ───────────────────────────────────────────────

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
    const parsed = CreateKeySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    // Generate key: bb_live_ + 32 random hex chars (16 bytes)
    const randomPart = crypto.randomBytes(16).toString('hex')
    const rawKey = `bb_live_${randomPart}`
    const keyPrefix = randomPart.slice(0, 8)
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const serviceClient = createServiceClient()
    const { data: inserted, error } = await serviceClient
      .from('api_keys')
      .insert({
        bot_id: botId,
        label: parsed.data.label,
        key_prefix: keyPrefix,
        key_hash: keyHash,
      })
      .select('id, label, key_prefix, created_at, revoked_at')
      .single()

    if (error) throw error

    logAudit({
      action: 'api_key_created',
      botId,
      userId: user.id,
      metadata: { label: parsed.data.label, key_prefix: keyPrefix },
    }).catch(console.error)

    // Return raw key — this is the ONLY time it is shown
    return Response.json({ key: rawKey, record: inserted }, { status: 201 })
  } catch (error) {
    console.error('[api-keys POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
