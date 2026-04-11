'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, RotateCcw } from 'lucide-react'

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

interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  content: string
  streaming?: boolean
}

interface TestingChatProps {
  botId: string
  sessionId: string
  botName: string
  greeting: string | null
  onResponseComplete: (result: DebugResult) => void
  onSessionReset: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal markdown renderer: handles **bold**, *italic*, `code`, bullets, newlines */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, li) => {
    const isBullet = /^[-*•]\s/.test(line)
    const lineText = isBullet ? line.replace(/^[-*•]\s/, '') : line

    const parts: React.ReactNode[] = []
    const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
    let last = 0
    let match: RegExpExecArray | null

    while ((match = inlineRe.exec(lineText)) !== null) {
      if (match.index > last) parts.push(lineText.slice(last, match.index))
      if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>)
      else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>)
      else if (match[4]) parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 rounded text-xs font-mono"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#7dd3fc' }}
        >
          {match[4]}
        </code>
      )
      last = match.index + match[0].length
    }
    if (last < lineText.length) parts.push(lineText.slice(last))

    return (
      <span key={li} className={`block ${isBullet ? 'pl-4' : ''}`}>
        {isBullet && <span className="mr-2 opacity-40">•</span>}
        {parts.length > 0 ? parts : '\u200B'}
      </span>
    )
  })
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end mb-4">
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1"
        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--bb-primary)',
              animation: 'bb-dot-bounce 1.2s infinite ease-in-out',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TestingChat({
  botId,
  sessionId,
  botName,
  greeting,
  onResponseComplete,
  onSessionReset,
}: TestingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const welcomeText = greeting ?? `Hi! I'm ${botName}. How can I help you today?`
    return [{ id: 'welcome', role: 'bot', content: welcomeText }]
  })
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ─────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)

    // Add user message
    const userMsgId = `user-${Date.now()}`
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text }])

    // Placeholder for bot streaming response
    const botMsgId = `bot-${Date.now()}`
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', content: '', streaming: true }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(`/api/testing/${botId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string }
        throw new Error(err.error ?? `HTTP ${response.status}`)
      }

      // Read response headers immediately (available before stream body)
      const intentHeader = response.headers.get('X-Intent') ?? ''
      const languageHeader = response.headers.get('X-Language') ?? 'en'
      const ragFoundHeader = response.headers.get('X-Rag-Found') === 'true'

      // Stream the response body
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk
          setMessages(prev =>
            prev.map(m => m.id === botMsgId ? { ...m, content: fullText } : m)
          )
        }
      }

      // Mark streaming done
      setMessages(prev =>
        prev.map(m => m.id === botMsgId ? { ...m, streaming: false } : m)
      )
      setIsStreaming(false)

      // Fetch pipeline debug — wait briefly for fire-and-forget DB write to settle
      await new Promise(r => setTimeout(r, 700))

      const fetchDebug = async (attempt = 1): Promise<void> => {
        const debugRes = await fetch(
          `/api/conversations/${botId}/debug/last?session_id=${sessionId}`
        )
        if (debugRes.status === 404 && attempt < 3) {
          await new Promise(r => setTimeout(r, 1000))
          return fetchDebug(attempt + 1)
        }
        if (!debugRes.ok) return

        const data = await debugRes.json() as DebugResult & {
          intent: string | null
          language: string
          ragFound: boolean
          latencyMs: number
          totalDurationMs: number
        }

        onResponseComplete({
          steps: data.steps ?? [],
          ragChunks: data.ragChunks ?? [],
          intent: data.intent ?? (intentHeader || null),
          language: data.language ?? languageHeader,
          ragFound: data.ragFound ?? ragFoundHeader,
          latencyMs: data.latencyMs ?? 0,
          totalDurationMs: data.totalDurationMs ?? 0,
        })
      }

      await fetchDebug()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('[TestingChat]', err)
      setMessages(prev =>
        prev.map(m =>
          m.id === botMsgId
            ? { ...m, content: 'Error: ' + ((err as Error).message ?? 'Request failed'), streaming: false }
            : m
        )
      )
      setIsStreaming(false)
    }
  }, [botId, input, isStreaming, onResponseComplete, sessionId])

  // ── Clear conversation ───────────────────────────────────────────────────

  function handleClear() {
    abortRef.current?.abort()
    setIsStreaming(false)
    setInput('')
    const welcomeText = greeting ?? `Hi! I'm ${botName}. How can I help you today?`
    setMessages([{ id: 'welcome', role: 'bot', content: welcomeText }])
    onSessionReset()
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Animation keyframes — scoped to this component */}
      <style>{`
        @keyframes bb-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)', background: 'var(--bb-surface)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--bb-primary)' }}
            >
              {botName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              {botName}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--bb-success)' }}
            >
              testing
            </span>
          </div>
          <button
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              color: 'var(--bb-text-3)',
              background: 'var(--bb-surface-2)',
              border: '1px solid var(--bb-border)',
            }}
            title="Clear conversation"
            onClick={handleClear}
          >
            <RotateCcw size={11} />
            Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? { background: 'var(--bb-surface-3)', color: 'var(--bb-text-1)' }
                    : {
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.15)',
                        color: 'var(--bb-text-1)',
                      }
                }
              >
                {msg.role === 'bot'
                  ? renderMarkdown(msg.content || (msg.streaming ? '' : ''))
                  : msg.content
                }
                {msg.streaming && !msg.content && (
                  /* Still waiting for first byte — show inline cursor */
                  <span
                    className="inline-block w-0.5 h-3.5 ml-0.5 align-middle"
                    style={{
                      background: 'var(--bb-primary)',
                      animation: 'bb-dot-bounce 1s infinite',
                    }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator before first byte arrives */}
          {isStreaming && messages[messages.length - 1]?.streaming && !messages[messages.length - 1]?.content && (
            <TypingIndicator />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--bb-border)', background: 'var(--bb-surface)' }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--bb-surface-2)',
              border: '1px solid var(--bb-border)',
              color: 'var(--bb-text-1)',
              minHeight: '40px',
              maxHeight: '120px',
            }}
            placeholder="Type a test message… (Enter to send)"
            value={input}
            disabled={isStreaming}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: input.trim() && !isStreaming ? 'var(--bb-primary)' : 'var(--bb-surface-3)',
              color: input.trim() && !isStreaming ? '#fff' : 'var(--bb-text-3)',
            }}
            disabled={!input.trim() || isStreaming}
            onClick={handleSend}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
