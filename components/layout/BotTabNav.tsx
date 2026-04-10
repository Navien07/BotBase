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
  { label: 'Testing', path: '/testing' },
]

export function BotTabNav({ botId }: { botId: string }) {
  const pathname = usePathname()
  const base = `/dashboard/bots/${botId}`

  return (
    <div
      className="flex items-center gap-0 mb-5 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--bb-border)' }}
    >
      {BOT_TABS.map((tab) => {
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
