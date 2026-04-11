import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface TenantUsage {
  tenant_id: string
  tenant_name: string
  bot_count: number
  total_conversations: number
  total_messages: number
  created_at: string
}

export async function GET(req: Request) {
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
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')

    // Fetch all tenants
    const { data: tenants, error: tenantsError } = await serviceClient
      .from('tenants')
      .select('id, name, created_at')
      .order('created_at', { ascending: true })

    if (tenantsError) throw tenantsError

    // Fetch all bots
    const { data: bots, error: botsError } = await serviceClient
      .from('bots')
      .select('id, tenant_id')

    if (botsError) throw botsError

    // Fetch all conversations (just bot_id for counting)
    const { data: conversations, error: convError } = await serviceClient
      .from('conversations')
      .select('id, bot_id')

    if (convError) throw convError

    // Fetch all messages (just bot_id for counting)
    const { data: messages, error: msgError } = await serviceClient
      .from('messages')
      .select('id, bot_id')

    if (msgError) throw msgError

    // Build lookup maps
    const botsByTenant: Record<string, string[]> = {}
    for (const bot of bots ?? []) {
      if (!botsByTenant[bot.tenant_id]) botsByTenant[bot.tenant_id] = []
      botsByTenant[bot.tenant_id].push(bot.id)
    }

    const convsByBot: Record<string, number> = {}
    for (const conv of conversations ?? []) {
      convsByBot[conv.bot_id] = (convsByBot[conv.bot_id] ?? 0) + 1
    }

    const msgsByBot: Record<string, number> = {}
    for (const msg of messages ?? []) {
      msgsByBot[msg.bot_id] = (msgsByBot[msg.bot_id] ?? 0) + 1
    }

    const result: TenantUsage[] = (tenants ?? []).map((t) => {
      const tenantBotIds = botsByTenant[t.id] ?? []
      const totalConversations = tenantBotIds.reduce((sum, bid) => sum + (convsByBot[bid] ?? 0), 0)
      const totalMessages = tenantBotIds.reduce((sum, bid) => sum + (msgsByBot[bid] ?? 0), 0)

      return {
        tenant_id: t.id,
        tenant_name: t.name,
        bot_count: tenantBotIds.length,
        total_conversations: totalConversations,
        total_messages: totalMessages,
        created_at: t.created_at,
      }
    })

    // CSV export
    if (format === 'csv') {
      const headers = ['Tenant', 'Bots', 'Conversations', 'Messages', 'Member Since']
      const rows = result.map((r) => [
        `"${r.tenant_name.replace(/"/g, '""')}"`,
        r.bot_count,
        r.total_conversations,
        r.total_messages,
        new Date(r.created_at).toISOString().split('T')[0],
      ])

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=usage.csv',
        },
      })
    }

    return Response.json({ tenants: result })
  } catch (error) {
    console.error('[admin/billing GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
