'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { TestingChat, type ChatMessage } from '@/components/testing/TestingChat'
import { PipelinePanel } from '@/components/testing/PipelinePanel'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, History, RefreshCw } from 'lucide-react'

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

interface SessionRow {
  id: string
  sessionId: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage: string | null
}

interface DbMessage {
  id: string
  role: string
  content: string
}

// ─── SessionsList ─────────────────────────────────────────────────────────────

function SessionsList({
  botId,
  sessions,
  loading,
  onRefresh,
  onLoad,
}: {
  botId: string
  sessions: SessionRow[]
  loading: boolean
  onRefresh: () => void
  onLoad: (session: SessionRow, messages: ChatMessage[]) => void
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleLoad(session: SessionRow) {
    setLoadingId(session.id)
    try {
      const res = await fetch(`/api/conversations/${botId}/${session.id}`)
      if (!res.ok) return
      const data = await res.json() as { messages: DbMessage[] }
      const chatMessages: ChatMessage[] = (data.messages ?? []).map(m => ({
        id: m.id,
        role: m.role === 'user' ? 'user' : 'bot',
        content: m.content,
      }))
      onLoad(session, chatMessages)
    } catch (err) {
      console.error('[SessionsList]', err)
    } finally {
      setLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Loading sessions…</span>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <span className="text-2xl">💬</span>
        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>No past sessions yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--bb-text-3)', background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
        >
          <RefreshCw size={10} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.map(session => (
          <div
            key={session.id}
            className="flex items-start justify-between gap-3 px-3 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono" style={{ color: 'var(--bb-text-2)' }}>
                  {session.id.slice(0, 8)}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)' }}
                >
                  {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                </span>
              </div>
              {session.lastMessage && (
                <p
                  className="text-xs truncate"
                  style={{ color: 'var(--bb-text-3)', maxWidth: '220px' }}
                  title={session.lastMessage}
                >
                  {session.lastMessage}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: 'var(--bb-text-3)', opacity: 0.6 }}>
                {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
              </p>
            </div>

            <button
              onClick={() => handleLoad(session)}
              disabled={loadingId === session.id}
              className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-colors"
              style={{
                background: 'rgba(99,102,241,0.08)',
                color: 'var(--bb-primary)',
                border: '1px solid rgba(99,102,241,0.2)',
                opacity: loadingId === session.id ? 0.5 : 1,
              }}
            >
              {loadingId === session.id ? '…' : 'Continue'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestingPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = use(params)

  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [chatKey, setChatKey] = useState(0)
  const [botName, setBotName] = useState('Bot')
  const [greeting, setGreeting] = useState<string | null>(null)
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [rightTab, setRightTab] = useState<'pipeline' | 'sessions'>('pipeline')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>(undefined)

  // ── Fetch bot config ────────────────────────────────────────────────────

  useEffect(() => {
    if (!botId) return
    fetch(`/api/config/${botId}/personality`)
      .then(r => r.ok ? r.json() as Promise<{ personality: BotPersonality }> : null)
      .then(data => {
        if (!data) return
        const p = data.personality
        setBotName(p.bot_name ?? 'Bot')
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

  // ── Fetch sessions ──────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch(`/api/test-sessions/${botId}`)
      if (res.ok) {
        const data = await res.json() as { sessions: SessionRow[] }
        setSessions(data.sessions ?? [])
      }
    } catch {
      // non-critical
    } finally {
      setSessionsLoading(false)
    }
  }, [botId])

  useEffect(() => {
    if (configLoaded) loadSessions()
  }, [configLoaded, loadSessions])

  // ── Callbacks ────────────────────────────────────────────────────────────

  const handleResponseComplete = useCallback((result: DebugResult) => {
    setDebugResult(result)
    setRightTab('pipeline')
    // Refresh session list after a message is sent
    void loadSessions()
  }, [loadSessions])

  const handleSessionReset = useCallback(() => {
    setSessionId(crypto.randomUUID())
    setDebugResult(null)
    setInitialMessages(undefined)
    setChatKey(k => k + 1)
  }, [])

  const handleLoadSession = useCallback((session: SessionRow, messages: ChatMessage[]) => {
    setSessionId(session.sessionId)
    setInitialMessages(messages)
    setDebugResult(null)
    setChatKey(k => k + 1)
    setRightTab('pipeline')
  }, [])

  const handleTabChange = useCallback((tab: 'pipeline' | 'sessions') => {
    setRightTab(tab)
    if (tab === 'sessions') loadSessions()
  }, [loadSessions])

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
      {/* Left — Chat pane */}
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
            key={chatKey}
            botId={botId}
            sessionId={sessionId}
            botName={botName}
            greeting={greeting}
            onResponseComplete={handleResponseComplete}
            onSessionReset={handleSessionReset}
            initialMessages={initialMessages}
          />
        </div>
      </div>

      {/* Right — Pipeline / Sessions pane */}
      <div
        className="overflow-hidden flex flex-col"
        style={{ background: 'var(--bb-bg)' }}
      >
        <div
          className="flex flex-col overflow-hidden"
          style={{ margin: '12px', flex: 1 }}
        >
          {/* Panel header with tabs */}
          <div
            className="flex items-center gap-0 px-3 py-0 rounded-t-lg flex-shrink-0"
            style={{
              background: 'var(--bb-surface)',
              border: '1px solid var(--bb-border)',
              borderBottom: 'none',
              height: '40px',
            }}
          >
            <button
              onClick={() => handleTabChange('pipeline')}
              className="flex items-center gap-1.5 text-xs px-3 h-full transition-colors border-b-2"
              style={{
                color: rightTab === 'pipeline' ? 'var(--bb-text-1)' : 'var(--bb-text-3)',
                borderBottomColor: rightTab === 'pipeline' ? 'var(--bb-primary)' : 'transparent',
                background: 'transparent',
              }}
            >
              <span>🔬</span>
              Pipeline
            </button>
            <button
              onClick={() => handleTabChange('sessions')}
              className="flex items-center gap-1.5 text-xs px-3 h-full transition-colors border-b-2"
              style={{
                color: rightTab === 'sessions' ? 'var(--bb-text-1)' : 'var(--bb-text-3)',
                borderBottomColor: rightTab === 'sessions' ? 'var(--bb-primary)' : 'transparent',
                background: 'transparent',
              }}
            >
              <History size={11} />
              Sessions
              {sessions.length > 0 && (
                <span
                  className="text-xs px-1.5 rounded-full font-mono"
                  style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)', fontSize: '10px' }}
                >
                  {sessions.length}
                </span>
              )}
            </button>

            <span className="flex-1" />
            <span className="text-xs font-mono pr-2" style={{ color: 'var(--bb-text-3)' }}>
              {sessionId.slice(0, 8)}
            </span>
          </div>

          {/* Panel body */}
          <div
            className="flex-1 overflow-hidden"
            style={{
              border: '1px solid var(--bb-border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--bb-radius-lg) var(--bb-radius-lg)',
              background: rightTab === 'sessions' ? 'var(--bb-surface)' : 'var(--bb-bg)',
              padding: rightTab === 'pipeline' ? '12px' : '0',
            }}
          >
            {rightTab === 'pipeline' ? (
              <PipelinePanel
                steps={debugResult?.steps ?? null}
                ragChunks={debugResult?.ragChunks ?? null}
                intent={debugResult?.intent ?? null}
                language={debugResult?.language ?? null}
                ragFound={debugResult?.ragFound ?? false}
                latencyMs={debugResult?.latencyMs ?? 0}
                totalDurationMs={debugResult?.totalDurationMs ?? 0}
              />
            ) : (
              <SessionsList
                botId={botId}
                sessions={sessions}
                loading={sessionsLoading}
                onRefresh={loadSessions}
                onLoad={handleLoadSession}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
