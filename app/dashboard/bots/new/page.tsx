'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewBotPage() {
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
      {/* Back */}
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
          {/* Bot name */}
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

          {/* Industry */}
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

          {/* Default language */}
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

          {/* Personality */}
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

          {/* Error */}
          {error && (
            <p className="text-sm" style={{ color: 'var(--bb-danger)' }}>{error}</p>
          )}

          {/* Actions */}
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
