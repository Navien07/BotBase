'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'

// ─── Industry → default system prompt ────────────────────────────────────────

const INDUSTRY_DEFAULTS: Record<string, string> = {
  healthcare: 'You are a helpful healthcare assistant. Provide accurate general health information, help users understand services, and guide them to book appointments. Always recommend consulting a qualified medical professional for specific medical advice.',
  insurance: 'You are a knowledgeable insurance assistant. Help users understand their coverage options, explain policy terms clearly, and assist with inquiries. Direct complex claims or legal questions to a licensed agent.',
  property: 'You are a professional property assistant. Help clients find suitable properties, explain listing details, and schedule viewings. Provide accurate information about the property market and guide users through the inquiry process.',
  fnb: 'You are a friendly restaurant assistant. Help guests with reservations, menu inquiries, dietary requirements, and special requests. Ensure every interaction feels warm and welcoming.',
  ecommerce: 'You are a helpful e-commerce assistant. Help customers find products, check order status, understand return policies, and resolve queries quickly. Aim to make every shopping experience smooth and satisfying.',
  professional_services: 'You are a professional business assistant. Help clients understand your services, schedule consultations, and get answers to common questions. Maintain a formal, knowledgeable tone at all times.',
  education: 'You are a supportive education assistant. Help students and parents with course information, enrollment processes, and academic queries. Provide clear, encouraging guidance at every step.',
  other: 'You are a helpful AI assistant for this business. Answer customer questions accurately, help with bookings and inquiries, and provide excellent service. Be polite, clear, and concise.',
}

// ─── Component ────────────────────────────────────────────────────────────────

function ConfigurePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const botId = searchParams.get('botId') ?? ''

  const [systemPrompt, setSystemPrompt] = useState('')
  const [welcomeEn, setWelcomeEn] = useState('Hi! How can I help you today? 😊')
  const [welcomeBm, setWelcomeBm] = useState('Hai! Bagaimana saya boleh membantu anda hari ini? 😊')
  const [blockedKeywords, setBlockedKeywords] = useState('')
  const [deflectionMsg, setDeflectionMsg] = useState("I'm sorry, I can only help with questions related to our business. Please contact us directly for other inquiries.")
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const industryRef = useRef<string>('other')

  // Load bot to get industry / existing config
  useEffect(() => {
    if (!botId) return
    fetch(`/api/config/${botId}/settings`)
      .then((r) => r.json())
      .then((data) => {
        const bot = data.settings
        if (!bot) return

        // Store industry for regenerate
        industryRef.current = bot.industry ?? 'other'

        if (bot.system_prompt) {
          setSystemPrompt(bot.system_prompt)
        } else {
          setSystemPrompt(INDUSTRY_DEFAULTS[industryRef.current] ?? INDUSTRY_DEFAULTS.other)
        }

        if (bot.greeting_en) setWelcomeEn(bot.greeting_en)
        if (bot.greeting_bm) setWelcomeBm(bot.greeting_bm)
        if (bot.keyword_blocklist?.length) {
          setBlockedKeywords(bot.keyword_blocklist.join(', '))
        }
        if (bot.fallback_message) setDeflectionMsg(bot.fallback_message)
      })
      .catch(() => {
        // Use industry default even if fetch fails
        setSystemPrompt(INDUSTRY_DEFAULTS.other)
      })
  }, [botId])

  async function handleRegenerate() {
    if (!botId) return
    setRegenerating(true)
    setError('')

    try {
      const res = await fetch(`/api/bots/${botId}/regenerate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: industryRef.current }),
      })

      if (!res.ok) throw new Error('Failed to regenerate')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let text = ''
      setSystemPrompt('')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setSystemPrompt(text)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleSave() {
    if (!botId) return
    setSaving(true)
    setError('')

    try {
      const keywords = blockedKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)

      // Partial update via PATCH /api/bots/[botId]
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          greeting_en: welcomeEn,
          greeting_bm: welcomeBm,
          keyword_blocklist: keywords,
          fallback_message: deflectionMsg,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to save')
      }

      await fetch('/api/onboarding/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'configure', botId }),
      })

      router.push(`/onboarding/connect-channel?botId=${botId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-[oklch(0.94_0_0)]">
          Configure your bot
        </h1>
        <p className="text-[oklch(0.63_0_0)] text-sm">
          Set your bot&apos;s personality, welcome message, and guardrails.
        </p>
      </div>

      <div className="space-y-5">
        {/* System prompt */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[oklch(0.94_0_0)]">System prompt</label>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || !botId}
              className="flex items-center gap-1.5 text-xs text-[oklch(0.585_0.223_264.4)] hover:text-[oklch(0.7_0.223_264.4)] disabled:opacity-50 transition-colors"
            >
              {regenerating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />
              }
              {regenerating ? 'Generating…' : '✨ Regenerate with AI'}
            </button>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            className="w-full px-3 py-2.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm resize-none transition-colors font-mono leading-relaxed"
            placeholder="Describe how your bot should behave…"
          />
        </div>

        {/* Welcome message EN */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Welcome message <span className="text-[oklch(0.63_0_0)] font-normal">(English)</span>
          </label>
          <textarea
            value={welcomeEn}
            onChange={(e) => setWelcomeEn(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm resize-none transition-colors"
          />
        </div>

        {/* Welcome message BM */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Welcome message <span className="text-[oklch(0.63_0_0)] font-normal">(Bahasa Melayu)</span>
          </label>
          <textarea
            value={welcomeBm}
            onChange={(e) => setWelcomeBm(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm resize-none transition-colors"
          />
        </div>

        {/* Blocked keywords */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Blocked keywords
            <span className="text-[oklch(0.37_0_0)] font-normal ml-1.5 text-xs">comma-separated</span>
          </label>
          <input
            type="text"
            value={blockedKeywords}
            onChange={(e) => setBlockedKeywords(e.target.value)}
            placeholder="competitor, promo code, refund…"
            className="w-full px-3 py-2.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm transition-colors"
          />
        </div>

        {/* Off-topic deflection */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[oklch(0.94_0_0)]">
            Off-topic deflection message
          </label>
          <input
            type="text"
            value={deflectionMsg}
            onChange={(e) => setDeflectionMsg(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm transition-colors"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[oklch(0.637_0.217_25.3)]">{error}</p>
        )}

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-[oklch(0.585_0.223_264.4)] hover:bg-[oklch(0.52_0.223_264.4)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save & Continue →'}
        </button>
      </div>
    </div>
  )
}

export default function ConfigurePage() {
  return (
    <Suspense>
      <ConfigurePageInner />
    </Suspense>
  )
}
