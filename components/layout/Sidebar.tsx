'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Radio,
  Bell,
  GitBranch,
  BookOpen,
  HelpCircle,
  Smile,
  Shield,
  FileText,
  Calendar,
  Wifi,
  Puzzle,
  Terminal,
  Key,
  Settings,
  ChevronLeft,
  ChevronRight,
  Crown,
  Building2,
  Activity,
  UserCheck,
  BarChart3,
} from 'lucide-react'
import { BotSwitcher } from './BotSwitcher'
import { useTranslation } from '@/lib/i18n/provider'
import type { Bot, UserRole } from '@/types/database'

interface SidebarProps {
  bots: Bot[]
  role: UserRole
  userEmail: string
  displayName: string
}

interface NavItem {
  key: string
  icon: React.ElementType
  href: string
}

interface NavSection {
  label?: string
  items: NavItem[]
}

function getBotNavSections(botId: string): NavSection[] {
  const base = `/dashboard/bots/${botId}`
  return [
    {
      items: [
        { key: 'conversations', icon: MessageSquare, href: `${base}/conversations` },
        { key: 'contacts', icon: Users, href: `${base}/contacts` },
        { key: 'broadcasts', icon: Radio, href: `${base}/broadcasts` },
        { key: 'followups', icon: Bell, href: `${base}/followups` },
      ],
    },
    {
      label: 'Knowledge',
      items: [
        { key: 'scripts', icon: GitBranch, href: `${base}/scripts` },
        { key: 'knowledge', icon: BookOpen, href: `${base}/knowledge` },
        { key: 'faqs', icon: HelpCircle, href: `${base}/faqs` },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { key: 'personality', icon: Smile, href: `${base}/personality` },
        { key: 'guardrails', icon: Shield, href: `${base}/guardrails` },
        { key: 'templates', icon: FileText, href: `${base}/templates` },
        { key: 'booking', icon: Calendar, href: `${base}/booking` },
      ],
    },
    {
      label: 'Channels',
      items: [
        { key: 'channels', icon: Wifi, href: `${base}/channels` },
        { key: 'widget', icon: Puzzle, href: `${base}/widget` },
        { key: 'integrations', icon: BarChart3, href: `${base}/integrations` },
      ],
    },
    {
      label: 'Developer',
      items: [
        { key: 'testing', icon: Terminal, href: `${base}/testing` },
        { key: 'apiKeys', icon: Key, href: `${base}/api-keys` },
        { key: 'settings', icon: Settings, href: `${base}/settings` },
      ],
    },
  ]
}

const SUPER_ADMIN_SECTION: NavSection = {
  label: 'Super Admin',
  items: [
    { key: 'allTenants', icon: Building2, href: '/dashboard/admin/tenants' },
    { key: 'botsMonitor', icon: Activity, href: '/dashboard/admin/bots' },
    { key: 'users', icon: UserCheck, href: '/dashboard/admin/users' },
    { key: 'billing', icon: BarChart3, href: '/dashboard/admin/billing' },
  ],
}

export function Sidebar({ bots, role }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const { t } = useTranslation()

  // Determine current bot from URL
  const botMatch = pathname.match(/\/dashboard\/bots\/([^/]+)/)
  const currentBotId = botMatch?.[1] ?? bots[0]?.id ?? null
  const botSections = currentBotId ? getBotNavSections(currentBotId) : []

  const overviewActive = pathname === '/dashboard/overview'

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const width = isCollapsed ? 56 : 240

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full relative transition-all duration-200"
      style={{
        width,
        minWidth: width,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--bb-border-subtle)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-14 flex-shrink-0 px-4"
        style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
      >
        {isCollapsed ? (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            B
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              B
            </div>
            <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--bb-text-1)' }}>
              BotBase
            </span>
          </div>
        )}
      </div>

      {/* Bot Switcher */}
      <div className="py-3" style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}>
        <BotSwitcher bots={bots} isCollapsed={isCollapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* Overview — always visible */}
        <NavLink
          href="/dashboard/overview"
          icon={LayoutDashboard}
          label={t('Navigation.overview')}
          isActive={overviewActive}
          isCollapsed={isCollapsed}
        />

        {/* Bot-scoped sections */}
        {botSections.map((section, i) => (
          <div key={i} className="mt-4">
            {section.label && !isCollapsed && (
              <p
                className="px-3 mb-1 text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--bb-text-3)' }}
              >
                {section.label}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={t(`Navigation.${item.key}`)}
                isActive={isActive(item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        ))}

        {/* Super admin section */}
        {role === 'super_admin' && (
          <div className="mt-4">
            {!isCollapsed && (
              <div className="flex items-center gap-1 px-3 mb-1">
                <Crown size={10} style={{ color: 'var(--bb-warning)' }} />
                <p
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--bb-warning)' }}
                >
                  {t('Navigation.superAdmin')}
                </p>
              </div>
            )}
            {SUPER_ADMIN_SECTION.items.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                label={t(`Navigation.${item.key}`)}
                isActive={isActive(item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 flex-shrink-0" style={{ borderTop: '1px solid var(--bb-border-subtle)' }}>
        <button
          className="flex items-center justify-center w-full h-8 rounded-lg transition-colors"
          style={{ color: 'var(--bb-text-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bb-surface-3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}

interface NavLinkProps {
  href: string
  icon: React.ElementType
  label: string
  isActive: boolean
  isCollapsed: boolean
}

function NavLink({ href, icon: Icon, label, isActive, isCollapsed }: NavLinkProps) {
  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className="flex items-center gap-2.5 rounded-lg transition-colors relative"
      style={{
        padding: isCollapsed ? '8px' : '8px 10px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        background: isActive ? 'var(--bb-primary-subtle)' : 'transparent',
        color: isActive ? 'var(--bb-primary)' : 'var(--bb-text-2)',
        borderLeft: isActive && !isCollapsed ? '3px solid var(--bb-primary)' : '3px solid transparent',
        marginLeft: isCollapsed ? 0 : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--bb-surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {!isCollapsed && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
    </Link>
  )
}
