import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, MessageSquare, ShieldAlert, TrendingUp, Plus, BookOpen, GitBranch, Wifi } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { SnapshotStrip } from '@/components/analytics/SnapshotStrip'

export default async function OverviewPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  // Do NOT redirect('/login') here — authenticated user → login → proxy → /dashboard/overview → loop
  // Layout already handles auth; treat missing profile as a new user with no bots

  // Get accessible bot IDs
  let botsQuery = supabase.from('bots').select('id, name, is_active')
  if (profile && profile.role !== 'super_admin' && profile.tenant_id) {
    botsQuery = botsQuery.eq('tenant_id', profile.tenant_id)
  } else if (profile && profile.role === 'super_admin') {
    // super_admin sees all bots — no filter
  } else {
    // No profile or tenant_admin with no tenant — show empty state
    botsQuery = botsQuery.eq('tenant_id', 'no-tenant-placeholder').limit(0)
  }
  const { data: bots } = await botsQuery

  const botIds = (bots ?? []).map((b: { id: string }) => b.id)
  const hasBots = botIds.length > 0

  // KPI queries (parallel)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    contactsResult,
    messagesTodayResult,
    recentConversationsResult,
    trendResult,
  ] = await Promise.all([
    // Total contacts
    hasBots
      ? supabase.from('contacts').select('id', { count: 'exact', head: true }).in('bot_id', botIds)
      : Promise.resolve({ count: 0, error: null }),

    // Messages today
    hasBots
      ? supabase.from('messages').select('id', { count: 'exact', head: true })
          .in('bot_id', botIds)
          .gte('created_at', today.toISOString())
      : Promise.resolve({ count: 0, error: null }),

    // Recent conversations
    hasBots
      ? supabase.from('conversations')
          .select('id, bot_id, external_user_id, channel, last_message_at, language')
          .in('bot_id', botIds)
          .order('last_message_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),

    // 7-day message trend
    hasBots
      ? supabase.from('messages')
          .select('created_at', { count: 'exact' })
          .in('bot_id', botIds)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      : Promise.resolve({ data: [], count: 0, error: null }),
  ])

  const totalContacts = contactsResult.count ?? 0
  const messagesToday = messagesTodayResult.count ?? 0
  const recentConversations = (recentConversationsResult.data ?? []) as Array<{
    id: string
    bot_id: string
    external_user_id: string
    channel: string
    last_message_at: string | null
    language: string
  }>
  const weeklyMessages = trendResult.count ?? 0

  const kpis = [
    {
      label: 'Total Contacts',
      value: totalContacts.toLocaleString(),
      icon: Users,
      color: 'var(--bb-primary)',
      bg: 'var(--bb-primary-subtle)',
    },
    {
      label: 'Messages Today',
      value: messagesToday.toLocaleString(),
      icon: MessageSquare,
      color: 'var(--bb-accent)',
      bg: 'rgba(34,211,238,0.1)',
    },
    {
      label: 'This Week',
      value: weeklyMessages.toLocaleString(),
      icon: TrendingUp,
      color: 'var(--bb-success)',
      bg: 'rgba(34,197,94,0.1)',
    },
    {
      label: 'Active Bots',
      value: (bots ?? []).filter((b: { is_active: boolean }) => b.is_active).length.toLocaleString(),
      icon: ShieldAlert,
      color: 'var(--bb-warning)',
      bg: 'rgba(245,158,11,0.1)',
    },
  ]

  const quickActions = [
    { label: 'Add Knowledge', icon: BookOpen, href: hasBots && botIds[0] ? `/dashboard/bots/${botIds[0]}/knowledge` : '/dashboard/bots' },
    { label: 'Build Flow', icon: GitBranch, href: hasBots && botIds[0] ? `/dashboard/bots/${botIds[0]}/scripts` : '/dashboard/bots' },
    { label: 'Connect Channel', icon: Wifi, href: hasBots && botIds[0] ? `/dashboard/bots/${botIds[0]}/channels` : '/dashboard/bots' },
    { label: 'New Bot', icon: Plus, href: '/dashboard/clients/new' },
  ]

  const channelEmoji: Record<string, string> = {
    whatsapp: '💬',
    telegram: '✈️',
    web_widget: '🌐',
    api: '🔌',
    instagram: '📸',
    facebook: '👥',
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Performance Snapshot — uses first accessible bot; aggregation across all bots is a future enhancement */}
      {hasBots && botIds[0] && (
        <SnapshotStrip botId={botIds[0]} defaultPeriod="7d" />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-4 border"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>
                {kpi.label}
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: kpi.bg }}
              >
                <kpi.icon size={16} style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--bb-text-1)' }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Conversations */}
        <div
          className="lg:col-span-2 rounded-xl border"
          style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--bb-border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
              Recent Conversations
            </h2>
            {hasBots && botIds[0] && (
              <Link
                href={`/dashboard/bots/${botIds[0]}/conversations`}
                className="text-xs transition-colors"
                style={{ color: 'var(--bb-primary)' }}
              >
                View all →
              </Link>
            )}
          </div>

          {recentConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-5">
              <MessageSquare size={32} style={{ color: 'var(--bb-text-3)', marginBottom: 12 }} />
              <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
                No conversations yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--bb-text-3)' }}>
                Connect a channel to start receiving messages
              </p>
            </div>
          ) : (
            <div>
              {recentConversations.map((conv) => {
                const bot = (bots ?? []).find((b: { id: string; name: string }) => b.id === conv.bot_id)
                return (
                  <Link
                    key={conv.id}
                    href={`/dashboard/bots/${conv.bot_id}/conversations/${conv.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors block hover:bg-[var(--bb-surface-2)]"
                    style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
                  >
                    <span className="text-lg flex-shrink-0">
                      {channelEmoji[conv.channel] ?? '💬'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
                        {conv.external_user_id}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                        {bot?.name ?? 'Unknown bot'} · {conv.channel}
                      </p>
                    </div>
                    {conv.last_message_at && (
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--bb-text-3)' }}>
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div
          className="rounded-xl border"
          style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: '1px solid var(--bb-border)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
              Quick Actions
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-[var(--bb-surface-2)] hover:bg-[var(--bb-surface-3)] text-[var(--bb-text-2)]"
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--bb-primary-subtle)' }}
                >
                  <action.icon size={14} style={{ color: 'var(--bb-primary)' }} />
                </div>
                {action.label}
              </Link>
            ))}
          </div>

          {/* Bots status mini-list */}
          {(bots ?? []).length > 0 && (
            <div style={{ borderTop: '1px solid var(--bb-border)', padding: '16px' }}>
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--bb-text-3)' }}>
                BOT STATUS
              </p>
              <div className="space-y-2">
                {(bots ?? []).slice(0, 4).map((bot: { id: string; name: string; is_active: boolean }) => (
                  <div key={bot.id} className="flex items-center justify-between">
                    <span className="text-xs truncate" style={{ color: 'var(--bb-text-2)' }}>
                      {bot.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        background: bot.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bb-surface-3)',
                        color: bot.is_active ? 'var(--bb-success)' : 'var(--bb-text-3)',
                      }}
                    >
                      {bot.is_active ? 'Live' : 'Off'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
