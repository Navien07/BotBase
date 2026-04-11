'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle } from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { emoji: '🏥', label: 'Healthcare', value: 'healthcare' },
  { emoji: '🛡️', label: 'Insurance', value: 'insurance' },
  { emoji: '🏠', label: 'Property', value: 'property' },
  { emoji: '🍽️', label: 'F&B', value: 'fnb' },
  { emoji: '🛍️', label: 'E-commerce', value: 'ecommerce' },
  { emoji: '💼', label: 'Professional Services', value: 'professional_services' },
  { emoji: '🎓', label: 'Education', value: 'education' },
  { emoji: '🔧', label: 'Other', value: 'other' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'bm', label: 'Bahasa Malaysia' },
  { value: 'zh', label: 'Chinese' },
  { value: 'multi', label: 'All three' },
]

const PERSONALITIES = [
  { value: 'friendly', emoji: '😊', label: 'Friendly', desc: 'Warm and approachable' },
  { value: 'professional', emoji: '💼', label: 'Professional', desc: 'Formal and precise' },
  { value: 'enthusiastic', emoji: '⚡', label: 'Enthusiastic', desc: 'Energetic and upbeat' },
]

// ─── Success State ─────────────────────────────────────────────────────────────

interface SuccessInfo {
  tenantId: string
  tenantName: string
  botName: string
  adminEmail: string
}

function SuccessState({ info, onReset }: { info: SuccessInfo; onReset: () => void }) {
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [invitedEmails, setInvitedEmails] = useState<string[]>([])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviteLoading(true)
    setInviteError('')

    try {
      const res = await fetch(`/api/admin/tenants/${info.tenantId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Invite failed')
      }
      setInvitedEmails((prev) => [...prev, inviteEmail.trim()])
      setInviteEmail('')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div
        className="rounded-xl border p-8 space-y-6"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'rgba(34,197,94,0.1)' }}
        >
          <CheckCircle size={28} style={{ color: 'var(--bb-success)' }} />
        </div>

        <div className="text-center">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
            Client created successfully
          </h2>
          <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
            The client will receive an email to set up their password. Once logged in, they will
            land directly on their bot dashboard.
          </p>
        </div>

        <div className="space-y-2.5">
          {[
            { icon: '✅', label: 'Client created', value: info.tenantName },
            { icon: '✅', label: 'Bot created', value: info.botName },
            { icon: '📧', label: 'Invite sent to', value: info.adminEmail },
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span>{icon}</span>
              <span style={{ color: 'var(--bb-text-3)' }}>{label}:</span>
              <span style={{ color: 'var(--bb-text-1)' }}>{value}</span>
            </div>
          ))}
        </div>

        {invitedEmails.length > 0 && (
          <div className="space-y-1.5">
            {invitedEmails.map((email) => (
              <div key={email} className="flex items-center gap-2 text-sm">
                <CheckCircle size={14} style={{ color: 'var(--bb-success)', flexShrink: 0 }} />
                <span style={{ color: 'var(--bb-text-2)' }}>{email} invited</span>
              </div>
            ))}
          </div>
        )}

        {showInviteForm && (
          <form onSubmit={handleInvite} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@client.com"
                autoFocus
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--bb-surface-2)',
                  border: '1px solid var(--bb-border)',
                  color: 'var(--bb-text-1)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-primary)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
              />
              <button
                type="submit"
                disabled={inviteLoading || !inviteEmail.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                {inviteLoading ? '…' : 'Send Invite'}
              </button>
            </div>
            {inviteError && (
              <p className="text-xs" style={{ color: 'var(--bb-danger)' }}>{inviteError}</p>
            )}
          </form>
        )}

        <div className="space-y-2 pt-2">
          <div className="flex gap-3">
            <Link
              href="/dashboard/admin/tenants"
              className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-center transition-colors"
              style={{
                background: 'var(--bb-surface-2)',
                borderColor: 'var(--bb-border)',
                color: 'var(--bb-text-2)',
              }}
            >
              View All Clients
            </Link>
            <button
              onClick={() => setShowInviteForm((v) => !v)}
              className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors"
              style={{
                background: showInviteForm ? 'rgba(99,102,241,0.1)' : 'var(--bb-surface-2)',
                borderColor: showInviteForm ? 'var(--bb-primary)' : 'var(--bb-border)',
                color: showInviteForm ? 'var(--bb-text-1)' : 'var(--bb-text-2)',
              }}
            >
              + Add Another Admin
            </button>
          </div>
          <button
            onClick={onReset}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            Create Another Client
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form ──────────────────────────────────────────────────────────────────────

export default function NewClientForm() {
  const [clientName, setClientName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [botName, setBotName] = useState('')
  const [industry, setIndustry] = useState('')
  const [language, setLanguage] = useState('en')
  const [personality, setPersonality] = useState('friendly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [partialError, setPartialError] = useState('')
  const [success, setSuccess] = useState<SuccessInfo | null>(null)

  function handleClientNameChange(value: string) {
    setClientName(value)
    if (!botName || botName === `${clientName} Bot`) {
      setBotName(value ? `${value} Bot` : '')
    }
  }

  function resetForm() {
    setClientName('')
    setAdminEmail('')
    setBotName('')
    setIndustry('')
    setLanguage('en')
    setPersonality('friendly')
    setError('')
    setPartialError('')
    setSuccess(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!clientName.trim() || clientName.trim().length < 2) {
      setError('Company name must be at least 2 characters.')
      return
    }
    if (!adminEmail.trim()) {
      setError('Admin email is required.')
      return
    }
    if (!botName.trim() || botName.trim().length < 2) {
      setError('Bot name must be at least 2 characters.')
      return
    }
    if (!industry) {
      setError('Please select an industry.')
      return
    }

    setLoading(true)
    setError('')
    setPartialError('')

    // Step 1: Create tenant + send first invite
    let tenantId: string
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName.trim(), adminEmail: adminEmail.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to create tenant')
      }
      const data = await res.json() as { tenant: { id: string } }
      tenantId = data.tenant.id
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client')
      setLoading(false)
      return
    }

    // Step 2: Create bot
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: botName.trim(),
          industry,
          default_language: language === 'multi' ? 'en' : language,
          personality_preset: personality,
          tenant_id: tenantId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to create bot')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bot creation failed'
      setPartialError(
        `Tenant created and invite sent, but bot creation failed: ${msg}. ` +
        `Go to Admin → Tenants to create the bot manually.`
      )
      setLoading(false)
      return
    }

    setSuccess({
      tenantId,
      tenantName: clientName.trim(),
      botName: botName.trim(),
      adminEmail: adminEmail.trim(),
    })
    setLoading(false)
  }

  if (success) {
    return <SuccessState info={success} onReset={resetForm} />
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/dashboard/bots"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--bb-text-3)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--bb-text-2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--bb-text-3)' }}
      >
        <ArrowLeft size={14} />
        Back to Bots
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>
          New Client Setup
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
          Create a client account and their first bot
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Client Details */}
        <div
          className="rounded-xl border p-6 space-y-4"
          style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--bb-text-3)' }}>
            1 — Client Details
          </h2>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Company Name <span style={{ color: 'var(--bb-danger)' }}>*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={clientName}
              onChange={(e) => handleClientNameChange(e.target.value)}
              placeholder="e.g. Elken Sdn Bhd"
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-primary)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Admin Email <span style={{ color: 'var(--bb-danger)' }}>*</span>
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@client.com"
              className="w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-primary)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
            />
            <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
              An invite link will be sent to this email
            </p>
          </div>
        </div>

        {/* Section 2: Bot Details */}
        <div
          className="rounded-xl border p-6 space-y-5"
          style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--bb-text-3)' }}>
            2 — Bot Details
          </h2>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Bot Name <span style={{ color: 'var(--bb-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g. Aria, BizBot, Ask Ethan…"
              minLength={2}
              maxLength={60}
              className="w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bb-primary)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--bb-border)' }}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Industry <span style={{ color: 'var(--bb-danger)' }}>*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind.value}
                  type="button"
                  onClick={() => setIndustry(ind.value)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors"
                  style={{
                    background: industry === ind.value ? 'rgba(99,102,241,0.1)' : 'var(--bb-surface-2)',
                    borderColor: industry === ind.value ? 'var(--bb-primary)' : 'var(--bb-border)',
                    color: industry === ind.value ? 'var(--bb-text-1)' : 'var(--bb-text-2)',
                  }}
                >
                  <span className="text-xl">{ind.emoji}</span>
                  <span className="text-xs font-medium leading-tight">{ind.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Default Language
            </label>
            <div className="flex gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => setLanguage(lang.value)}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    background: language === lang.value ? 'rgba(99,102,241,0.15)' : 'var(--bb-surface-2)',
                    borderColor: language === lang.value ? 'var(--bb-primary)' : 'var(--bb-border)',
                    color: language === lang.value ? 'var(--bb-text-1)' : 'var(--bb-text-2)',
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Personality
            </label>
            <div className="grid grid-cols-3 gap-3">
              {PERSONALITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPersonality(p.value)}
                  className="flex flex-col items-center gap-1.5 p-4 rounded-lg border transition-colors text-center"
                  style={{
                    background: personality === p.value ? 'rgba(99,102,241,0.1)' : 'var(--bb-surface-2)',
                    borderColor: personality === p.value ? 'var(--bb-primary)' : 'var(--bb-border)',
                    color: personality === p.value ? 'var(--bb-text-1)' : 'var(--bb-text-2)',
                  }}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-sm font-semibold">{p.label}</span>
                  <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Errors */}
        {error && (
          <p className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--bb-danger)' }}>
            {error}
          </p>
        )}
        {partialError && (
          <p className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--bb-warning)' }}>
            {partialError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pb-8">
          <Link
            href="/dashboard/bots"
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-center transition-colors"
            style={{
              background: 'var(--bb-surface-2)',
              borderColor: 'var(--bb-border)',
              color: 'var(--bb-text-2)',
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !clientName.trim() || !adminEmail.trim() || !botName.trim() || !industry}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {loading ? 'Creating…' : 'Create Client & Send Invite'}
          </button>
        </div>
      </form>
    </div>
  )
}
