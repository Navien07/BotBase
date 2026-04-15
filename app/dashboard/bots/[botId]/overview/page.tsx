import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MessageSquare, Users, Calendar, TrendingUp } from 'lucide-react'
import { SnapshotStrip } from '@/components/analytics/SnapshotStrip'
import { BotConversationTrend } from '@/components/analytics/BotConversationTrend'

interface Props {
  params: Promise<{ botId: string }>
}

export default async function BotOverviewPage({ params }: Props) {
  const { botId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bot } = await supabase
    .from('bots')
    .select('id, name, is_active')
    .eq('id', botId)
    .single()

  if (!bot) notFound()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [contactsRes, messagesTodayRes, conversationsRes, bookingsRes] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('bot_id', botId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('bot_id', botId).gte('created_at', today.toISOString()),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('bot_id', botId),
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('bot_id', botId).eq('status', 'confirmed'),
  ])

  const kpis = [
    { label: 'Total Contacts', value: contactsRes.count ?? 0, icon: Users, color: 'var(--bb-primary)', bg: 'var(--bb-primary-subtle)' },
    { label: 'Messages Today', value: messagesTodayRes.count ?? 0, icon: MessageSquare, color: 'var(--bb-accent)', bg: 'rgba(34,211,238,0.1)' },
    { label: 'Conversations', value: conversationsRes.count ?? 0, icon: TrendingUp, color: 'var(--bb-success)', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Confirmed Bookings', value: bookingsRes.count ?? 0, icon: Calendar, color: 'var(--bb-warning)', bg: 'rgba(245,158,11,0.1)' },
  ]

  return (
    <div className="space-y-6">
      {/* Performance Snapshot */}
      <SnapshotStrip botId={botId} defaultPeriod="7d" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-4 border"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>{kpi.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                <kpi.icon size={16} style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--bb-text-1)' }}>
              {kpi.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <BotConversationTrend botId={botId} />
    </div>
  )
}
