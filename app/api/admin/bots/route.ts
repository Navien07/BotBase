import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  // Super admin check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const serviceClient = createServiceClient()

    // Get all bots with tenant names
    const { data: bots, error: botsError } = await serviceClient
      .from('bots')
      .select('id, name, slug, is_active, tenant_id, created_at, tenants(name)')
      .order('created_at', { ascending: false })

    if (botsError) throw botsError

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Get message counts and rag_found stats per bot for last 7 days
    const { data: msgStats, error: msgError } = await serviceClient
      .from('messages')
      .select('bot_id, rag_found')
      .gte('created_at', since7d)

    if (msgError) throw msgError

    // Aggregate per bot
    const statsMap: Record<string, { total: number; rag_miss: number }> = {}
    for (const msg of msgStats ?? []) {
      if (!statsMap[msg.bot_id]) {
        statsMap[msg.bot_id] = { total: 0, rag_miss: 0 }
      }
      statsMap[msg.bot_id].total++
      if (!msg.rag_found) {
        statsMap[msg.bot_id].rag_miss++
      }
    }

    const result = (bots ?? []).map((bot) => {
      const stats = statsMap[bot.id] ?? { total: 0, rag_miss: 0 }
      const error_rate = stats.total > 0
        ? Math.round((stats.rag_miss / stats.total) * 100 * 10) / 10
        : 0

      const tenantRaw = bot.tenants as unknown
      const tenantRow = Array.isArray(tenantRaw)
        ? (tenantRaw[0] as { name: string } | undefined) ?? null
        : (tenantRaw as { name: string } | null)

      return {
        id: bot.id,
        name: bot.name,
        slug: bot.slug,
        is_active: bot.is_active,
        tenant_id: bot.tenant_id,
        tenant_name: tenantRow?.name ?? 'Unknown',
        total_messages_7d: stats.total,
        error_rate,
        created_at: bot.created_at,
      }
    })

    return Response.json({ bots: result })
  } catch (error) {
    console.error('[admin/bots GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
