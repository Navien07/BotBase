'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Rocket, Loader2 } from 'lucide-react'
import { TestingChat } from '@/components/testing/TestingChat'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebugResult {
  steps: unknown[]
  ragChunks: unknown[]
  intent: string | null
  language: string
  ragFound: boolean
  latencyMs: number
  totalDurationMs: number
}

// ─── Component ────────────────────────────────────────────────────────────────

function TestPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const botId = searchParams.get('botId') ?? ''

  const [sessionId] = useState(() => crypto.randomUUID())
  const [botName, setBotName] = useState('Your Bot')
  const [greeting, setGreeting] = useState<string | null>('Hi! How can I help you today?')
  const [goingLive, setGoingLive] = useState(false)
  const [liveError, setLiveError] = useState('')
  const sessionRef = useRef(sessionId)

  useEffect(() => {
    if (!botId) return
    fetch(`/api/config/${botId}/personality`)
      .then((r) => r.json())
      .then((data) => {
        if (data.bot_name) setBotName(data.bot_name)
        if (data.greeting_en) setGreeting(data.greeting_en)
      })
      .catch(() => {/* ignore */})
  }, [botId])

  function handleResponseComplete(_result: DebugResult) {
    // noop — no debug panel in onboarding
  }

  function handleSessionReset() {
    sessionRef.current = crypto.randomUUID()
  }

  async function handleGoLive() {
    if (!botId) return
    setGoingLive(true)
    setLiveError('')

    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Failed to activate bot')
      }

      await fetch('/api/onboarding/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'test', botId, completed: true }),
      }).catch(() => {})

      // Fire confetti then redirect
      const confetti = (await import('canvas-confetti')).default
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#22d3ee', '#22c55e', '#f59e0b'],
      })

      setTimeout(() => {
        router.push('/dashboard/overview')
      }, 2500)
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Something went wrong')
      setGoingLive(false)
    }
  }

  if (!botId) {
    return (
      <div className="text-center text-[oklch(0.63_0_0)] text-sm py-20">
        Missing bot ID. Please start from the beginning.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-[oklch(0.94_0_0)]">
          Test your bot
        </h1>
        <p className="text-[oklch(0.63_0_0)] text-sm">
          Try asking: &ldquo;What services do you offer?&rdquo;
        </p>
      </div>

      {/* Chat */}
      <div className="rounded-xl border border-[oklch(0.165_0_0)] bg-[oklch(0.09_0_0)] overflow-hidden" style={{ height: 400 }}>
        <TestingChat
          botId={botId}
          sessionId={sessionRef.current}
          botName={botName}
          greeting={greeting}
          onResponseComplete={handleResponseComplete}
          onSessionReset={handleSessionReset}
        />
      </div>

      {/* Status note */}
      <div className="px-4 py-3 rounded-lg bg-[oklch(0.585_0.223_264.4_/_0.08)] border border-[oklch(0.585_0.223_264.4_/_0.2)]">
        <p className="text-sm text-[oklch(0.7_0.1_264.4)] text-center">
          Your bot is ready! Activate it to go live.
        </p>
      </div>

      {/* Error */}
      {liveError && (
        <p className="text-sm text-[oklch(0.637_0.217_25.3)] text-center">{liveError}</p>
      )}

      {/* Go Live button */}
      <button
        type="button"
        onClick={handleGoLive}
        disabled={goingLive}
        className="w-full py-4 rounded-xl bg-[oklch(0.585_0.223_264.4)] hover:bg-[oklch(0.52_0.223_264.4)] disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold text-base transition-all flex items-center justify-center gap-3 shadow-lg shadow-[oklch(0.585_0.223_264.4_/_0.3)]"
      >
        {goingLive ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Going live…
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            🚀 Go Live!
          </>
        )}
      </button>
    </div>
  )
}

export default function TestPage() {
  return (
    <Suspense>
      <TestPageInner />
    </Suspense>
  )
}
