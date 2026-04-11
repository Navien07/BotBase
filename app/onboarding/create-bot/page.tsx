'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Industry {
  emoji: string
  label: string
  value: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const INDUSTRIES: Industry[] = [
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
  { value: 'en', label: 'EN' },
  { value: 'bm', label: 'BM' },
  { value: 'zh', label: 'ZH' },
  { value: 'multi', label: 'Multi' },
]

const PERSONALITIES = [
  { value: 'friendly', emoji: '😊', label: 'Friendly', desc: 'Warm and approachable' },
  { value: 'professional', emoji: '💼', label: 'Professional', desc: 'Formal and precise' },
  { value: 'enthusiastic', emoji: '⚡', label: 'Enthusiastic', desc: 'Energetic and upbeat' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateBotPage() {
  const router = useRouter()

  const [botName, setBotName] = useState('')
  const [industry, setIndustry] = useState('')
  const [language, setLanguage] = useState('en')
  const [personality, setPersonality] = useState('friendly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!botName.trim() || !industry) {
      setError('Please fill in all required fields.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Create bot
      const botRes = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: botName.trim(),
          industry,
          default_language: language === 'multi' ? 'en' : language,
          personality_preset: personality,
        }),
      })

      if (!botRes.ok) {
        const err = await botRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to create bot')
      }

      const { bot } = await botRes.json()

      // 2. Record onboarding progress
      await fetch('/api/onboarding/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'create_bot', botId: bot.id }),
      })

      router.push(`/onboarding/upload-docs?botId=${bot.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-[oklch(0.94_0_0)]">
          Create your AI bot
        </h1>
        <p className="text-[oklch(0.63_0_0)] text-sm">
          Tell us about your business and we&apos;ll set everything up.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bot name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Bot name <span className="text-[oklch(0.637_0.217_25.3)]">*</span>
          </label>
          <input
            type="text"
            autoFocus
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="e.g. Aria, BizBot, Ask Ethan…"
            maxLength={60}
            className="w-full px-3 py-2.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] focus:ring-1 focus:ring-[oklch(0.585_0.223_264.4)] transition-colors text-sm"
          />
        </div>

        {/* Industry picker */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Industry <span className="text-[oklch(0.637_0.217_25.3)]">*</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind.value}
                type="button"
                onClick={() => setIndustry(ind.value)}
                className={[
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all',
                  industry === ind.value
                    ? 'border-[oklch(0.585_0.223_264.4)] bg-[oklch(0.585_0.223_264.4_/_0.1)] text-[oklch(0.94_0_0)]'
                    : 'border-[oklch(0.165_0_0)] bg-[oklch(0.09_0_0)] text-[oklch(0.63_0_0)] hover:border-[oklch(0.3_0_0)] hover:text-[oklch(0.94_0_0)]',
                ].join(' ')}
              >
                <span className="text-xl">{ind.emoji}</span>
                <span className="text-xs font-medium leading-tight">{ind.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default language */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Default language
          </label>
          <div className="flex gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => setLanguage(lang.value)}
                className={[
                  'flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
                  language === lang.value
                    ? 'border-[oklch(0.585_0.223_264.4)] bg-[oklch(0.585_0.223_264.4_/_0.15)] text-[oklch(0.94_0_0)]'
                    : 'border-[oklch(0.165_0_0)] bg-[oklch(0.09_0_0)] text-[oklch(0.63_0_0)] hover:border-[oklch(0.3_0_0)] hover:text-[oklch(0.94_0_0)]',
                ].join(' ')}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Personality */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Personality
          </label>
          <div className="grid grid-cols-3 gap-3">
            {PERSONALITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPersonality(p.value)}
                className={[
                  'flex flex-col items-center gap-1.5 p-4 rounded-lg border transition-all text-center',
                  personality === p.value
                    ? 'border-[oklch(0.585_0.223_264.4)] bg-[oklch(0.585_0.223_264.4_/_0.1)] text-[oklch(0.94_0_0)]'
                    : 'border-[oklch(0.165_0_0)] bg-[oklch(0.09_0_0)] text-[oklch(0.63_0_0)] hover:border-[oklch(0.3_0_0)] hover:text-[oklch(0.94_0_0)]',
                ].join(' ')}
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="text-sm font-semibold">{p.label}</span>
                <span className="text-xs text-[oklch(0.63_0_0)]">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[oklch(0.637_0.217_25.3)]">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !botName.trim() || !industry}
          className="w-full py-3 rounded-lg bg-[oklch(0.585_0.223_264.4)] hover:bg-[oklch(0.52_0.223_264.4)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          {loading ? 'Creating…' : 'Create My Bot →'}
        </button>
      </form>
    </div>
  )
}
