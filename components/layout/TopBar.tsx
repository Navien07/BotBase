'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/provider'
import { LogOut, User, Settings, ChevronDown, HelpCircle } from 'lucide-react'
import type { Lang } from '@/lib/i18n/provider'
import { HelpGuideDrawer } from './HelpGuideDrawer'

interface TopBarProps {
  userEmail: string
  displayName: string
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard/overview': 'Overview',
  '/dashboard/bots': 'My Bots',
  '/dashboard/admin/tenants': 'All Tenants',
  '/dashboard/admin/bots': 'Bots Monitor',
  '/dashboard/admin/users': 'Users',
  '/dashboard/admin/billing': 'Usage',
}

function getPageTitle(pathname: string): string {
  // Exact match
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]

  // Bot sub-pages: /dashboard/bots/[id]/[page]
  const segmentMap: Record<string, string> = {
    conversations: 'Conversations',
    contacts: 'Contacts',
    broadcasts: 'Broadcasts',
    followups: 'Follow-ups',
    scripts: 'Flow Builder',
    knowledge: 'Knowledge Base',
    faqs: 'FAQs',
    personality: 'Personality',
    guardrails: 'Guardrails',
    templates: 'Templates',
    booking: 'Booking',
    channels: 'Channels',
    widget: 'Web Widget',
    integrations: 'Integrations',
    testing: 'Testing Console',
    'api-keys': 'API Keys',
    settings: 'Settings',
    overview: 'Overview',
  }
  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? ''
  return segmentMap[lastSegment] ?? 'Dashboard'
}

export function TopBar({ userEmail, displayName }: TopBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { lang, setLang } = useTranslation()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  const pageTitle = getPageTitle(pathname)
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function toggleLanguage() {
    setLang(lang === 'en' ? 'bm' : ('en' as Lang))
  }

  return (
    <>
    <header
      className="flex items-center justify-between h-14 pl-14 pr-6 md:px-6 flex-shrink-0"
      style={{
        background: 'var(--bb-surface)',
        borderBottom: '1px solid var(--bb-border)',
      }}
    >
      {/* Page title */}
      <h1 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
        {pageTitle}
      </h1>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Help guide button */}
        <button
          onClick={() => setGuideOpen(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--bb-text-3)', border: '1px solid var(--bb-border)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bb-surface-2)'; e.currentTarget.style.color = 'var(--bb-text-1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--bb-text-3)' }}
          title="Page guide"
        >
          <HelpCircle size={15} />
        </button>

        {/* Language toggle */}
        <button
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors"
          style={{
            background: 'var(--bb-surface-2)',
            border: '1px solid var(--bb-border)',
            color: 'var(--bb-text-2)',
          }}
          onClick={toggleLanguage}
        >
          <span style={{ color: lang === 'en' ? 'var(--bb-text-1)' : 'var(--bb-text-3)', fontWeight: lang === 'en' ? 600 : 400 }}>
            EN
          </span>
          <span style={{ color: 'var(--bb-text-3)' }}>|</span>
          <span style={{ color: lang === 'bm' ? 'var(--bb-text-1)' : 'var(--bb-text-3)', fontWeight: lang === 'bm' ? 600 : 400 }}>
            BM
          </span>
        </button>

        {/* Avatar dropdown */}
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bb-surface-2)' }}
            onMouseLeave={(e) => { if (!avatarOpen) e.currentTarget.style.background = 'transparent' }}
            onClick={() => setAvatarOpen(!avatarOpen)}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {initials || <User size={14} />}
            </div>
            <span className="text-xs hidden sm:block" style={{ color: 'var(--bb-text-2)', maxWidth: 120 }}>
              {displayName || userEmail}
            </span>
            <ChevronDown
              size={12}
              style={{ color: 'var(--bb-text-3)', transform: avatarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
          </button>

          {avatarOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAvatarOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-lg border z-20 overflow-hidden py-1"
                style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)' }}
              >
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--bb-border)' }}>
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
                    {displayName || userEmail}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--bb-text-3)' }}>
                    {userEmail}
                  </p>
                </div>
                <DropdownItem
                  icon={<Settings size={14} />}
                  label="Profile Settings"
                  onClick={() => { setAvatarOpen(false); router.push('/dashboard/settings') }}
                />
                <DropdownItem
                  icon={<LogOut size={14} />}
                  label="Sign out"
                  onClick={() => { setAvatarOpen(false); handleSignOut() }}
                  danger
                />
              </div>
            </>
          )}
        </div>
      </div>
    </header>

    <HelpGuideDrawer isOpen={guideOpen} onClose={() => setGuideOpen(false)} pathname={pathname} />
    </>
  )
}

function DropdownItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors"
      style={{ color: danger ? 'var(--bb-danger)' : 'var(--bb-text-2)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bb-surface-3)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}
