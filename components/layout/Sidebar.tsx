'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bot as BotIcon,
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
  Lock,
  Building2,
  Activity,
  UserCheck,
  BarChart3,
  Menu,
  X,
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
    { key: 'botsMonitor', icon: Activity, href: '/dashboard/admin/bots' },
    { key: 'users', icon: UserCheck, href: '/dashboard/admin/users' },
    { key: 'billing', icon: BarChart3, href: '/dashboard/admin/billing' },
  ],
}

export function Sidebar({ bots, role }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useTranslation()

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Dismiss mobile drawer on outside click
  useEffect(() => {
    if (!isMobileOpen) return
    function handleClick(e: MouseEvent) {
      const drawer = document.getElementById('bb-mobile-sidebar')
      if (drawer && !drawer.contains(e.target as Node)) {
        setIsMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isMobileOpen])

  // Determine current bot from URL
  const botMatch = pathname.match(/\/dashboard\/bots\/([^/]+)/)
  const currentBotId = botMatch?.[1] ?? bots[0]?.id ?? null
  // Always show bot sections — disabled (greyed out) when no bot exists yet
  const botSections = getBotNavSections(currentBotId ?? 'select')
  const botSectionsDisabled = !currentBotId

  const overviewActive = pathname === '/dashboard/overview'
  const botsActive = pathname === '/dashboard/bots'

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const width = isCollapsed ? 56 : 240

  // Shared nav content used by both desktop sidebar and mobile drawer
  function NavContent({ collapsed }: { collapsed: boolean }) {
    return (
      <>
        {/* Bot Switcher */}
        <div className="py-3" style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}>
          <BotSwitcher bots={bots} isCollapsed={collapsed} role={role} />
          {!currentBotId && !collapsed && (
            <div className="mx-3 mt-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-2">
              <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {role === 'super_admin' ? '👆 Create or select a bot to unlock these features' : '👆 Select a bot to unlock these features'}
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <NavLink
            href="/dashboard/overview"
            icon={LayoutDashboard}
            label={t('Navigation.overview')}
            isActive={overviewActive}
            isCollapsed={collapsed}
          />
          {role === 'super_admin' && (
            <NavLink
              href="/dashboard/bots"
              icon={BotIcon}
              label="All Bots"
              isActive={botsActive}
              isCollapsed={collapsed}
            />
          )}
          {role === 'super_admin' && (
            <NavLink
              href="/dashboard/admin/tenants"
              icon={Building2}
              label={t('Navigation.allTenants')}
              isActive={isActive('/dashboard/admin/tenants')}
              isCollapsed={collapsed}
            />
          )}
          {botSections.map((section, i) => (
            <div key={i} className="mt-4">
              {section.label && !collapsed && (
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
                  href={botSectionsDisabled ? '/dashboard/bots' : item.href}
                  icon={item.icon}
                  label={t(`Navigation.${item.key}`)}
                  isActive={!botSectionsDisabled && isActive(item.href)}
                  isCollapsed={collapsed}
                  disabled={botSectionsDisabled}
                />
              ))}
            </div>
          ))}
          {role === 'super_admin' && (
            <div className="mt-4">
              {!collapsed && (
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
                  isCollapsed={collapsed}
                />
              ))}
            </div>
          )}
        </nav>
      </>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ─────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full relative transition-all duration-200"
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

        <NavContent collapsed={isCollapsed} />

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

      {/* ── Mobile hamburger button ──────────────────────────────────────── */}
      <button
        className="fixed top-3 left-3 z-50 md:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu size={18} style={{ color: 'var(--bb-text-2)' }} />
      </button>

      {/* ── Mobile drawer overlay ────────────────────────────────────────── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Drawer */}
          <aside
            id="bb-mobile-sidebar"
            className="relative flex flex-col h-full"
            style={{
              width: 240,
              background: 'var(--sidebar)',
              borderRight: '1px solid var(--bb-border-subtle)',
            }}
          >
            {/* Logo + close button */}
            <div
              className="flex items-center justify-between h-14 flex-shrink-0 px-4"
              style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
            >
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
              <button
                onClick={() => setIsMobileOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--bb-text-3)' }}
                aria-label="Close navigation menu"
              >
                <X size={16} />
              </button>
            </div>
            <NavContent collapsed={false} />
          </aside>
        </div>
      )}
    </>
  )
}

interface NavLinkProps {
  href: string
  icon: React.ElementType
  label: string
  isActive: boolean
  isCollapsed: boolean
  disabled?: boolean
}

function NavLink({ href, icon: Icon, label, isActive, isCollapsed, disabled }: NavLinkProps) {
  return (
    <Link
      href={href}
      title={disabled ? 'Select a bot to access this section' : isCollapsed ? label : undefined}
      className="flex items-center gap-2.5 rounded-lg transition-colors relative"
      style={{
        padding: isCollapsed ? '8px' : '8px 10px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        background: isActive ? 'var(--bb-primary-subtle)' : 'transparent',
        color: isActive ? 'var(--bb-primary)' : disabled ? 'var(--bb-text-3)' : 'var(--bb-text-2)',
        borderLeft: isActive && !isCollapsed ? '3px solid var(--bb-primary)' : '3px solid transparent',
        marginLeft: isCollapsed ? 0 : undefined,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive && !disabled) e.currentTarget.style.background = 'var(--bb-surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!isActive && !disabled) e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {!isCollapsed && (
        <span className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{label}</span>
          {disabled && <Lock size={10} style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.6 }} />}
        </span>
      )}
    </Link>
  )
}
