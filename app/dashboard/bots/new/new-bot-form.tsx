'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  tenantName: string
  botName: string
  adminEmail: string
}

function SuccessState({ info, onReset }: { info: SuccessInfo; onReset: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center">
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

        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
            Client onboarded successfully
          </h2>
          <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
            Invite sent — they can activate their bot once they log in.
          </p>
        </div>

        <div className="text-left space-y-2.5">
          {[
            { label: 'Tenant created', value: info.tenantName },
            { label: 'Bot created', value: info.botName },
            { label: 'Invite sent to', value: info.adminEmail },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <CheckCircle size={16} style={{ color: 'var(--bb-success)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
                <span style={{ color: 'var(--bb-text-3)' }}>{label}:</span>{' '}
                <span style={{ color: 'var(--bb-text-1)' }}>{value}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/dashboard/admin/bots"
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-center transition-colors"
            style={{
              background: 'var(--bb-surface-2)',
              borderColor: 'var(--bb-border)',
              color: 'var(--bb-text-2)',
            }}
          >
            View All Bots
          </Link>
          <button
            onClick={onReset}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            Create Another
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Super Admin Form ──────────────────────────────────────────────────────────

function SuperAdminForm() {
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
      setError('Client name must be at least 2 characters.')
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

    // Step 1: Create tenant + send invite
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
        `Go to Tenants to create the bot manually.`
      )
      setLoading(false)
      return
    }

    setSuccess({
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
          Onboard New Client
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
          Create a tenant, configure their bot, and send the admin invite in one step.
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
              Company / Client name <span style={{ color: 'var(--bb-danger)' }}>*</span>
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
              Admin email address <span style={{ color: 'var(--bb-danger)' }}>*</span>
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="client@company.com"
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
              They will receive a magic link to activate their account.
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
              Bot name <span style={{ color: 'var(--bb-danger)' }}>*</span>
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
              Default language
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
            {loading ? 'Creating…' : 'Create & Send Invite'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Tenant Admin Form (original flow) ────────────────────────────────────────

function TenantAdminForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [language, setLanguage] = useState('en')
  const [personality, setPersonality] = useState('friendly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || name.trim().length < 2) {
      setError('Bot name must be at least 2 characters.')
      return
    }
    if (!industry) {
      setError('Please select an industry.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          industry,
          default_language: language === 'multi' ? 'en' : language,
          personality_preset: personality,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to create bot')
      }

      const { bot } = await res.json() as { bot: { id: string } }
      router.push(`/dashboard/bots/${bot.id}/knowledge`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
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
          Create New Bot
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
          Set up your AI agent in seconds.
        </p>
      </div>

      <div
        className="rounded-xl border p-6"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Bot name <span style={{ color: 'var(--bb-danger)' }}>*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              Default language
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

          {error && (
            <p className="text-sm" style={{ color: 'var(--bb-danger)' }}>{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
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
              disabled={loading || !name.trim() || !industry}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {loading ? 'Creating…' : 'Create Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Export ────────────────────────────────────────────────────────────────────

export function NewBotForm({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  console.log('[NewBotForm] isSuperAdmin:', isSuperAdmin)
  if (isSuperAdmin) return <SuperAdminForm />
  return <TenantAdminForm />
}
