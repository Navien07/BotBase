'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Wifi, MessageSquare, MoreVertical, Settings, Mail, UserPlus, Trash2, AlertTriangle } from 'lucide-react'
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
  const menuRef = useRef<HTMLDivElement>(null)

  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState('')
  const [resetError, setResetError] = useState('')

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setResetError('')
    setResetSuccess('')
    try {
      const res = await fetch(`/api/admin/tenants/${bot.tenant_id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setResetSuccess(`Password reset sent to ${resetEmail.trim()}`)
      setResetEmail('')
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to send reset')
    } finally {
      setResetLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteSuccess('')
    try {
      const res = await fetch(`/api/admin/tenants/${bot.tenant_id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const json = await res.json() as { type?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed')

      const sentEmail = inviteEmail.trim()
      setInviteSuccess(
        json.type === 'password_reset'
          ? `This email already has an account. Password reset link sent to ${sentEmail}`
          : `Invite sent to ${sentEmail}`
      )
      setInviteEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleDelete() {
    if (!bot.tenant_id) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${bot.tenant_id}`, { method: 'DELETE' })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      toast.success(`${bot.tenantName ?? bot.name} deleted permanently`)
      setShowDeleteModal(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  const clientLabel = bot.tenantName ?? bot.name

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
              <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bb-surface-3)]"
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
                      onClick={() => { setMenuOpen(false); setResetEmail(''); setResetSuccess(''); setResetError(''); setShowResetModal(true) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bb-surface-3)] transition-colors text-left"
                      style={{ color: 'var(--bb-text-1)' }}
                    >
                      <Mail size={14} style={{ flexShrink: 0 }} />
                      Send Password Reset
                    </button>
                    <div style={{ borderTop: '1px solid var(--bb-border-subtle)' }} />
                    <button
                      onClick={() => { setMenuOpen(false); setInviteEmail(''); setInviteSuccess(''); setShowInviteModal(true) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[var(--bb-surface-3)] transition-colors text-left"
                      style={{ color: 'var(--bb-text-1)' }}
                    >
                      <UserPlus size={14} style={{ flexShrink: 0 }} />
                      Add Another Admin
                    </button>
                    <div style={{ borderTop: '1px solid var(--bb-border-subtle)' }} />
                    <button
                      onClick={() => { setMenuOpen(false); setDeleteConfirm(''); setShowDeleteModal(true) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[rgba(239,68,68,0.08)] transition-colors text-left"
                      style={{ color: 'var(--bb-danger)' }}
                    >
                      <Trash2 size={14} style={{ flexShrink: 0 }} />
                      Delete Client
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--bb-text-1)' }}>{bot.name}</h3>
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
            <Wifi size={12} /> Channels
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--bb-text-3)' }}>
            <MessageSquare size={12} /> Conversations
          </span>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => !resetLoading && setShowResetModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border p-6 space-y-4"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-base" style={{ color: 'var(--bb-text-1)' }}>Send Password Reset</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--bb-text-3)' }}>
                Enter the admin email for <span style={{ color: 'var(--bb-text-2)' }}>{clientLabel}</span>
              </p>
            </div>

            {resetSuccess ? (
              <div className="space-y-4">
                <div
                  className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  <span style={{ color: 'var(--bb-success)' }}>✅</span>
                  <span style={{ color: 'var(--bb-text-1)' }}>{resetSuccess}</span>
                </div>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-3">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="admin@client.com"
                  required
                  autoFocus
                  disabled={resetLoading}
                  className="w-full px-3 py-2.5 rounded-lg text-sm disabled:opacity-50"
                  style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-primary)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
                />
                {resetError && (
                  <p className="text-xs" style={{ color: 'var(--bb-danger)' }}>{resetError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    disabled={resetLoading}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium border disabled:opacity-50"
                    style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail.trim()}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: 'var(--bb-primary)', color: '#fff' }}
                  >
                    {resetLoading ? 'Sending…' : 'Send Reset'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => !inviteLoading && setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border p-6 space-y-4"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-base" style={{ color: 'var(--bb-text-1)' }}>Add Another Admin</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--bb-text-3)' }}>
                Invite an admin to manage <span style={{ color: 'var(--bb-text-2)' }}>{clientLabel}</span>
              </p>
            </div>

            {inviteSuccess ? (
              <div className="space-y-4">
                <div
                  className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  <span style={{ color: 'var(--bb-success)' }}>✅</span>
                  <span style={{ color: 'var(--bb-text-1)' }}>{inviteSuccess}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setInviteSuccess(''); setInviteEmail('') }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
                    style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}
                  >
                    Add Another
                  </button>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--bb-primary)', color: '#fff' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="admin@client.com"
                  required
                  autoFocus
                  disabled={inviteLoading}
                  className="w-full px-3 py-2.5 rounded-lg text-sm disabled:opacity-50"
                  style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-primary)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    disabled={inviteLoading}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium border disabled:opacity-50"
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
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => !deleteLoading && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border p-6 space-y-5"
            style={{ background: 'var(--bb-surface)', borderColor: 'rgba(239,68,68,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--bb-danger)' }} />
              </div>
              <div>
                <h3 className="font-semibold text-base" style={{ color: 'var(--bb-text-1)' }}>Delete {clientLabel}?</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-3)' }}>This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="rounded-lg p-4 space-y-1.5 text-sm" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="font-medium mb-2" style={{ color: 'var(--bb-danger)' }}>The following will be permanently erased:</p>
              {[
                'Tenant account & all admin users',
                `Bot: ${bot.name} and all configuration`,
                'All conversations & messages',
                'All contacts & bookings',
                'All documents & knowledge base',
                'All broadcasts & analytics',
                'All channel connections',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2" style={{ color: 'var(--bb-text-2)' }}>
                  <span style={{ color: 'var(--bb-danger)', fontSize: 10 }}>✕</span>
                  {item}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
                Type <span className="font-mono font-semibold" style={{ color: 'var(--bb-text-1)' }}>{clientLabel}</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={clientLabel}
                autoFocus
                disabled={deleteLoading}
                className="w-full px-3 py-2.5 rounded-lg text-sm disabled:opacity-50"
                style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-danger)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border disabled:opacity-50"
                style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading || deleteConfirm !== clientLabel}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--bb-danger)', color: '#fff' }}
              >
                {deleteLoading ? 'Deleting…' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
