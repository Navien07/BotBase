'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, Bot, Plus } from 'lucide-react'
import type { Bot as BotType } from '@/types/database'

interface BotSwitcherProps {
  bots: BotType[]
  isCollapsed: boolean
}

export function BotSwitcher({ bots, isCollapsed }: BotSwitcherProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [currentBotId, setCurrentBotId] = useState<string | null>(
    () => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('bb_current_bot') ?? bots[0]?.id ?? null
      }
      return bots[0]?.id ?? null
    }
  )

  const currentBot = bots.find((b) => b.id === currentBotId) ?? bots[0] ?? null

  function selectBot(bot: BotType) {
    setCurrentBotId(bot.id)
    localStorage.setItem('bb_current_bot', bot.id)
    setOpen(false)
    router.push(`/dashboard/bots/${bot.id}/overview`)
  }

  if (isCollapsed) {
    if (bots.length === 0) {
      return (
        <Link
          href="/dashboard/clients/new"
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors mx-auto"
          style={{ background: 'var(--bb-surface-2)' }}
          title="Create your first bot"
        >
          <Plus size={18} style={{ color: 'var(--bb-primary)' }} />
        </Link>
      )
    }
    return (
      <button
        className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors mx-auto"
        style={{ background: 'var(--bb-surface-2)' }}
        title={currentBot?.name ?? 'Select bot'}
        onClick={() => setOpen(!open)}
      >
        <Bot size={18} style={{ color: 'var(--bb-primary)' }} />
      </button>
    )
  }

  if (bots.length === 0) {
    return (
      <div className="px-3">
        <Link
          href="/dashboard/clients/new"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors"
          style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-primary)' }}
        >
          <Plus size={14} style={{ flexShrink: 0 }} />
          <span className="text-xs font-medium">Create your first bot</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="relative px-3">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors text-left"
        style={{ background: 'var(--bb-surface-2)' }}
        onClick={() => setOpen(!open)}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0"
          style={{ background: 'var(--bb-primary-subtle)', color: 'var(--bb-primary)' }}
        >
          <Bot size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
            {currentBot?.name ?? 'No bot selected'}
          </p>
          <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
            {currentBot?.is_active ? 'Active' : 'Inactive'}
          </p>
        </div>
        <ChevronDown
          size={14}
          style={{ color: 'var(--bb-text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-3 right-3 top-full mt-1 rounded-lg border z-20 overflow-hidden py-1"
            style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)' }}
          >
            {bots.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                No bots yet
              </div>
            ) : (
              bots.map((bot) => (
                <button
                  key={bot.id}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                  style={{
                    background: bot.id === currentBotId ? 'var(--bb-primary-subtle)' : 'transparent',
                    color: 'var(--bb-text-1)',
                  }}
                  onMouseEnter={(e) => {
                    if (bot.id !== currentBotId) {
                      e.currentTarget.style.background = 'var(--bb-surface-3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (bot.id !== currentBotId) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                  onClick={() => selectBot(bot)}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: bot.is_active ? 'var(--bb-success)' : 'var(--bb-text-3)' }}
                  />
                  <span className="text-xs truncate">{bot.name}</span>
                </button>
              ))
            )}
            <div style={{ borderTop: '1px solid var(--bb-border)', marginTop: '4px', paddingTop: '4px' }}>
              <button
                className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors"
                style={{ color: 'var(--bb-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bb-surface-3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                onClick={() => { setOpen(false); router.push('/dashboard/clients/new') }}
              >
                <Plus size={12} />
                Create new bot
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
