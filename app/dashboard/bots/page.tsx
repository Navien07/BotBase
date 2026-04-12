import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { Plus, Bot } from 'lucide-react'
import { isSuperAdminEmail } from '@/lib/auth/super-admin'
import { BotCard } from './bot-card'

export default async function BotsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = isSuperAdminEmail(user.email) || profile?.role === 'super_admin'

  type BotRow = {
    id: string
    name: string
    slug: string
    is_active: boolean
    default_language: string
    created_at: string
    tenantName?: string
    tenant_id?: string
  }

  let bots: BotRow[] = []

  if (isSuperAdmin) {
    const { data } = await serviceClient
      .from('bots')
      .select('id, name, slug, is_active, default_language, created_at, tenant_id, tenants(name)')
      .order('created_at', { ascending: false })
    bots = (data ?? []).map((b) => {
      const t = b.tenants
      const tenantName = Array.isArray(t) ? (t[0] as { name: string } | undefined)?.name : (t as { name: string } | null)?.name
      return { ...b, tenants: undefined, tenantName }
    })
  } else if (profile?.tenant_id) {
    const { data } = await serviceClient
      .from('bots')
      .select('id, name, slug, is_active, default_language, created_at, tenant_id')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: true })
    bots = (data ?? []).map((b) => ({ ...b, tenantName: undefined }))
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            {isSuperAdmin ? 'All Bots' : 'My Bots'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            {bots.length} bot{bots.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        {isSuperAdmin && (
          <Link
            href="/dashboard/clients/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[var(--bb-primary)] hover:bg-[var(--bb-primary-h)] text-white"
          >
            <Plus size={16} />
            New Client
          </Link>
        )}
      </div>

      {bots.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl border"
          style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(99,102,241,0.1)' }}
          >
            <Bot size={28} style={{ color: 'var(--bb-primary)' }} />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
            {isSuperAdmin ? 'No clients yet' : 'Your bot is being set up'}
          </h3>
          <p className="text-sm mb-6 text-center max-w-sm" style={{ color: 'var(--bb-text-3)' }}>
            {isSuperAdmin
              ? 'Create your first client and bot to get started'
              : 'Your AI chatbot is being configured by the Iceberg AI team. It will appear here once ready. Contact navien@icebergaisolutions.com if you need assistance.'}
          </p>
          {isSuperAdmin && (
            <Link
              href="/dashboard/clients/new"
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              <Plus size={16} />
              + New Client
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} isSuperAdmin={isSuperAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}
