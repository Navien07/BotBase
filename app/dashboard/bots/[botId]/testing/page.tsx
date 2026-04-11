'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { TestingChat } from '@/components/testing/TestingChat'
import { PipelinePanel } from '@/components/testing/PipelinePanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NormalizedStep {
  step: number
  name: string
  status: 'pass' | 'block' | 'skip' | 'error'
  durationMs: number
  data: Record<string, unknown>
  blockedResponse?: string
}

interface DebugResult {
  steps: NormalizedStep[]
  ragChunks: Array<{ id: string; content: string }>
  intent: string | null
  language: string
  ragFound: boolean
  latencyMs: number
  totalDurationMs: number
}

interface BotPersonality {
  bot_name?: string
  greeting_en?: string | null
  greeting_bm?: string | null
  default_language?: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestingPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = use(params)

  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [botName, setBotName] = useState('Bot')
  const [greeting, setGreeting] = useState<string | null>(null)
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  // ── Fetch bot config on mount ────────────────────────────────────────────

  useEffect(() => {
    if (!botId) return
    fetch(`/api/config/${botId}/personality`)
      .then(r => r.ok ? r.json() as Promise<{ personality: BotPersonality }> : null)
      .then(data => {
        if (!data) return
        const p = data.personality
        setBotName(p.bot_name ?? 'Bot')
        // Use greeting for the detected/default language
        const lang = p.default_language ?? 'en'
        const greetingText =
          lang === 'bm' ? (p.greeting_bm ?? p.greeting_en ?? null)
          : lang === 'zh' ? null
          : (p.greeting_en ?? null)
        setGreeting(greetingText)
      })
      .catch(() => null)
      .finally(() => setConfigLoaded(true))
  }, [botId])

  // ── Callbacks ────────────────────────────────────────────────────────────

  const handleResponseComplete = useCallback((result: DebugResult) => {
    setDebugResult(result)
  }, [])

  const handleSessionReset = useCallback(() => {
    setSessionId(crypto.randomUUID())
    setDebugResult(null)
  }, [])

  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div
      className="grid overflow-hidden"
      style={{
        gridTemplateColumns: '2fr 3fr',
        height: 'calc(100vh - 4rem)',
        gap: '1px',
        background: 'var(--bb-border)',
      }}
    >
      {/* Left — Chat pane (40%) */}
      <div
        className="overflow-hidden flex flex-col"
        style={{ background: 'var(--bb-bg)' }}
      >
        <div
          className="flex-1 overflow-hidden rounded-lg"
          style={{
            margin: '12px',
            background: 'var(--bb-surface)',
            border: '1px solid var(--bb-border)',
          }}
        >
          <TestingChat
            botId={botId}
            sessionId={sessionId}
            botName={botName}
            greeting={greeting}
            onResponseComplete={handleResponseComplete}
            onSessionReset={handleSessionReset}
          />
        </div>
      </div>

      {/* Right — Pipeline debug pane (60%) */}
      <div
        className="overflow-hidden flex flex-col"
        style={{ background: 'var(--bb-bg)' }}
      >
        <div
          className="flex flex-col overflow-hidden"
          style={{
            margin: '12px',
            flex: 1,
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-t-lg flex-shrink-0"
            style={{
              background: 'var(--bb-surface)',
              border: '1px solid var(--bb-border)',
              borderBottom: 'none',
            }}
          >
            <span className="text-xs">🔬</span>
            <span className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              Pipeline Debug
            </span>
            <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
              · session {sessionId.slice(0, 8)}
            </span>
          </div>

          {/* Panel body */}
          <div
            className="flex-1 overflow-hidden"
            style={{
              border: '1px solid var(--bb-border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--bb-radius-lg) var(--bb-radius-lg)',
              background: 'var(--bb-bg)',
              padding: '12px',
            }}
          >
            <PipelinePanel
              steps={debugResult?.steps ?? null}
              ragChunks={debugResult?.ragChunks ?? null}
              intent={debugResult?.intent ?? null}
              language={debugResult?.language ?? null}
              ragFound={debugResult?.ragFound ?? false}
              latencyMs={debugResult?.latencyMs ?? 0}
              totalDurationMs={debugResult?.totalDurationMs ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
