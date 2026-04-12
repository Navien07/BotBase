'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Wifi, MessageSquare, MoreVertical, Settings, Mail, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

interface BotCardBot {
  id: string
  name: string
  slug: string
  is_active: boolean
  default_language: string
  tenantName?: string
  tenant_id?: string
}

interface BotCardProps {
  bot: BotCardBot
  isSuperAdmin: boolean
}

export function BotCard({ bot, isSuperAdmin }: BotCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  async function handleReset() {
    setMenuOpen(false)
    setResetLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${bot.tenant_id}/reset-password`, { method: 'POST' })
      const json = await res.json() as { emailsSent?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      const count = json.emailsSent ?? 0
      toast.success(`Password reset sent to ${count} admin${count !== 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset')
    } finally {
      setResetLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${bot.tenant_id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      toast.success(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      setShowInviteModal(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <>
      {/* Card */}
      <div
        onClick={() => router.push(`/dashboard/bots/${bot.id}/knowledge`)}
        className="relative rounded-xl border border-[var(--bb-border)] hover:border-[var(--bb-primary)] p-5 flex flex-col gap-4 transition-colors cursor-pointer"
        style={{ background: 'var(--bb-surface)' }}
      >
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.1)' }}
          >
            <Bot size={20} style={{ color: 'var(--bb-primary)' }} />
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: bot.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bb-surface-3)',
                color: bot.is_active ? 'var(--bb-success)' : 'var(--bb-text-3)',
              }}
            >
              {bot.is_active ? '● Live' : '○ Inactive'}
            </span>

            {isSuperAdmin && bot.tenant_id && (
              <div
                ref={menuRef}
                className="relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  disabled={resetLoading}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bb-surface-3)] disabled:opacity-50"
                  style={{ color: 'var(--bb-text-3)' }}
                  title="More actions"
                >
                  <MoreVertical size={15} />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-8 w-52 rounded-lg border shadow-xl z-50 overflow-hidden"
                    style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)' }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); router.push(`/dashboard/bots/${bot.id}/knowledge`) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bb-surface-3)] transition-colors text-left"
                      style={{ color: 'var(--bb-text-1)' }}
                    >
                      <Settings size={14} style={{ flexShrink: 0 }} />
                      Configure Bot
                    </button>
                    <div style={{ borderTop: '1px solid var(--bb-border-subtle)' }} />
                    <button
                      onClick={handleReset}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bb-surface-3)] transition-colors text-left"
                      style={{ color: 'var(--bb-text-1)' }}
                    >
                      <Mail size={14} style={{ flexShrink: 0 }} />
                      Send Password Reset
                    </button>
                    <div style={{ borderTop: '1px solid var(--bb-border-subtle)' }} />
                    <button
                      onClick={() => { setMenuOpen(false); setShowInviteModal(true) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bb-surface-3)] transition-colors text-left"
                      style={{ color: 'var(--bb-text-1)' }}
                    >
                      <UserPlus size={14} style={{ flexShrink: 0 }} />
                      Add Another Admin
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--bb-text-1)' }}>
            {bot.name}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            {bot.slug} · {bot.default_language.toUpperCase()}
          </p>
          {bot.tenantName && (
            <span
              className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)' }}
            >
              {bot.tenantName}
            </span>
          )}
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
      </div>

      {/* Add Admin Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border p-6 space-y-4"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-base" style={{ color: 'var(--bb-text-1)' }}>
                Add Another Admin
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--bb-text-3)' }}>
                Invite an admin to manage{' '}
                <span style={{ color: 'var(--bb-text-2)' }}>{bot.tenantName ?? bot.name}</span>
              </p>
            </div>

            <form onSubmit={handleInvite} className="space-y-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@client.com"
                required
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  background: 'var(--bb-surface-2)',
                  border: '1px solid var(--bb-border)',
                  color: 'var(--bb-text-1)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-primary)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
                  style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--bb-primary)', color: '#fff' }}
                >
                  {inviteLoading ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
