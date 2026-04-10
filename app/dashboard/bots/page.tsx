import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, Bot, Wifi, MessageSquare } from 'lucide-react'

export default async function BotsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  // Do NOT redirect('/login') — authenticated user → login → proxy → /dashboard → loop
  // Layout already handles auth; missing profile means new user, show empty state

  let query = supabase
    .from('bots')
    .select('id, name, slug, is_active, avatar_url, default_language, created_at, feature_flags')
    .order('created_at', { ascending: true })

  if (profile && profile.role !== 'super_admin' && profile.tenant_id) {
    query = query.eq('tenant_id', profile.tenant_id)
  } else if (!profile || (profile.role !== 'super_admin' && !profile.tenant_id)) {
    query = query.eq('tenant_id', 'no-tenant-placeholder').limit(0)
  }

  const { data: bots } = await query

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            My Bots
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            {(bots ?? []).length} bot{(bots ?? []).length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Link
          href="/dashboard/bots/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[var(--bb-primary)] hover:bg-[var(--bb-primary-h)] text-white"
        >
          <Plus size={16} />
          New Bot
        </Link>
      </div>

      {(!bots || bots.length === 0) ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl border"
          style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--bb-primary-subtle)' }}
          >
            <Bot size={28} style={{ color: 'var(--bb-primary)' }} />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
            No bots yet
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--bb-text-3)' }}>
            Create your first AI agent to get started
          </p>
          <Link
            href="/dashboard/bots/new"
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            <Plus size={16} />
            Create Bot
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot: {
            id: string
            name: string
            slug: string
            is_active: boolean
            default_language: string
            created_at: string
          }) => (
            <Link
              key={bot.id}
              href={`/dashboard/bots/${bot.id}/overview`}
              className="rounded-xl border border-[var(--bb-border)] hover:border-[var(--bb-primary)] p-5 flex flex-col gap-4 transition-colors block"
              style={{ background: 'var(--bb-surface)' }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--bb-primary-subtle)' }}
                >
                  <Bot size={20} style={{ color: 'var(--bb-primary)' }} />
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: bot.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bb-surface-3)',
                    color: bot.is_active ? 'var(--bb-success)' : 'var(--bb-text-3)',
                  }}
                >
                  {bot.is_active ? '● Live' : '○ Inactive'}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--bb-text-1)' }}>
                  {bot.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
                  {bot.slug} · {bot.default_language.toUpperCase()}
                </p>
              </div>

              <div className="flex items-center gap-3 mt-auto">
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                  <Wifi size={12} />
                  Channels
                </span>
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                  <MessageSquare size={12} />
                  Conversations
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
