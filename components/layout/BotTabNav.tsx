'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BOT_TABS = [
  { label: 'Overview', path: '/overview' },
  { label: 'Conversations', path: '/conversations' },
  { label: 'Contacts', path: '/contacts' },
  { label: 'Knowledge', path: '/knowledge' },
  { label: 'Personality', path: '/personality' },
  { label: 'Guardrails', path: '/guardrails' },
  { label: 'Channels', path: '/channels' },
  { label: 'Broadcasts', path: '/broadcasts' },
  { label: 'API Keys', path: '/api-keys' },
  { label: 'Scripts', path: '/scripts' },
  { label: 'Integrations', path: '/integrations' },
  { label: 'Testing', path: '/testing' },
  { label: 'Widget', path: '/widget' },
]

interface Tab {
  label: string
  path: string
}

export function BotTabNav({
  botId,
  extraTabs = [],
}: {
  botId: string
  extraTabs?: Tab[]
}) {
  const pathname = usePathname()
  const base = `/dashboard/bots/${botId}`
  const allTabs = [...BOT_TABS, ...extraTabs]

  return (
    <div
      className="flex items-center gap-0 mb-5 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--bb-border)' }}
    >
      {allTabs.map((tab) => {
        const href = `${base}${tab.path}`
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={tab.label}
            href={href}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0"
            style={{
              color: isActive ? 'var(--bb-primary)' : 'var(--bb-text-2)',
              borderBottom: isActive ? '2px solid var(--bb-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
