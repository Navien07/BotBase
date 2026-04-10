import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LanguageProvider } from '@/lib/i18n/provider'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { Bot, Profile, UserRole } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Profile missing — can happen when auth trigger missed a manually-created user.
  // Auto-create a minimal profile so the dashboard is accessible.
  if (!profile) {
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',').map((e: string) => e.trim())
    const role: UserRole = superAdminEmails.includes(user.email ?? '')
      ? 'super_admin'
      : 'tenant_admin'
    const serviceClient = createServiceClient()
    const { data: created, error: upsertError } = await serviceClient
      .from('profiles')
      .upsert({
        id: user.id,
        role,
        display_name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'User',
        language_preference: 'en',
        tenant_id: null,
      })
      .select()
      .single()
    if (upsertError) console.error('[dashboard/layout] profile upsert failed:', upsertError.message)
    profile = created
  }

  // DO NOT redirect('/login') here — would cause an infinite loop with proxy.ts
  // (proxy sees authenticated user → redirects back to /dashboard/overview → layout → redirect → loop)

  // Fetch bots for this tenant (or all bots for super_admin)
  let botsQuery = supabase
    .from('bots')
    .select('id, name, slug, is_active, avatar_url, feature_flags')
    .order('created_at', { ascending: true })

  if ((profile as Profile).role !== 'super_admin' && (profile as Profile).tenant_id) {
    botsQuery = botsQuery.eq('tenant_id', (profile as Profile).tenant_id!)
  }

  const { data: bots } = await botsQuery

  return (
    <LanguageProvider defaultLang={(profile as Profile).language_preference ?? 'en'}>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bb-bg)' }}>
        <Sidebar
          bots={(bots ?? []) as Bot[]}
          role={(profile as Profile).role}
          userEmail={user.email ?? ''}
          displayName={(profile as Profile).display_name ?? user.email ?? ''}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar
            userEmail={user.email ?? ''}
            displayName={(profile as Profile).display_name ?? user.email ?? ''}
          />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  )
}
