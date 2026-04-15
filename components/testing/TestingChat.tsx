'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, RotateCcw, Mic, MicOff } from 'lucide-react'

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

export interface ChatMessage {
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
  initialMessages?: ChatMessage[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5"
        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: 'var(--bb-primary)',
              display: 'inline-block',
              animation: 'bb-dot-bounce 1.2s infinite ease-in-out',
              animationDelay: `${i * 0.18}s`,
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
  initialMessages,
}: TestingChatProps) {
  const defaultWelcome = greeting ?? `Hi! I'm ${botName}. How can I help you today?`

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) return initialMessages
    return [{ id: 'welcome', role: 'bot', content: defaultWelcome }]
  })
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setVoiceSupported(
      typeof MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    )
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Core send logic ───────────────────────────────────────────────────────

  const sendToBot = useCallback(async (opts: {
    text: string
    displayText?: string  // shown in user bubble (for voice: transcription may differ)
    voiceData?: string
  }) => {
    if (isStreaming) return

    setIsStreaming(true)
    const userMsgId = `user-${Date.now()}`
    // Show display text immediately; updated to transcription later if voice
    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: opts.displayText ?? opts.text },
    ])

    const botMsgId = `bot-${Date.now()}`
    // Bot message starts as streaming placeholder (no content yet — TypingIndicator shows)
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', content: '', streaming: true }])

    const controller = new AbortController()
    abortRef.current = controller

    const body = opts.voiceData
      ? { voice_data: opts.voiceData, voice_filename: 'test-recording.webm', sessionId }
      : { message: opts.text, sessionId }

    try {
      const response = await fetch(`/api/testing/${botId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string }
        throw new Error(err.error ?? `HTTP ${response.status}`)
      }

      const intentHeader = response.headers.get('X-Intent') ?? ''
      const languageHeader = response.headers.get('X-Language') ?? 'en'
      const ragFoundHeader = response.headers.get('X-Rag-Found') === 'true'
      const transcription = response.headers.get('X-Transcription')
      const stepsB64 = response.headers.get('X-Pipeline-Steps')
      const totalDurationHeader = Number(response.headers.get('X-Total-Duration') ?? '0')

      // Decode compact steps from header — available immediately, no DB needed
      let headerSteps: NormalizedStep[] = []
      if (stepsB64) {
        try {
          headerSteps = JSON.parse(atob(stepsB64)) as NormalizedStep[]
        } catch {
          // ignore malformed header
        }
      }

      // Update user bubble with actual transcription if voice
      if (transcription) {
        setMessages(prev =>
          prev.map(m => m.id === userMsgId ? { ...m, content: transcription } : m)
        )
      }

      // Stream response body
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

      setMessages(prev =>
        prev.map(m => m.id === botMsgId ? { ...m, streaming: false } : m)
      )
      setIsStreaming(false)

      // Populate pipeline panel immediately from header steps (no DB wait)
      onResponseComplete({
        steps: headerSteps,
        ragChunks: [],
        intent: intentHeader || null,
        language: languageHeader,
        ragFound: ragFoundHeader,
        latencyMs: 0,
        totalDurationMs: totalDurationHeader,
      })

      // Then try DB for full step data (with data fields) + RAG chunk content
      await new Promise(r => setTimeout(r, 1200))

      const fetchDebug = async (attempt = 1): Promise<void> => {
        const debugRes = await fetch(
          `/api/conversations/${botId}/debug/last?session_id=${sessionId}`
        )
        if (debugRes.status === 404 && attempt < 3) {
          await new Promise(r => setTimeout(r, 1200))
          return fetchDebug(attempt + 1)
        }
        if (!debugRes.ok) return  // already have header data — no need to overwrite
        const data = await debugRes.json() as DebugResult
        // Only update if DB returned richer step data or RAG chunks
        if ((data.steps?.length ?? 0) > 0 || (data.ragChunks?.length ?? 0) > 0) {
          onResponseComplete({
            steps: data.steps ?? headerSteps,
            ragChunks: data.ragChunks ?? [],
            intent: data.intent ?? (intentHeader || null),
            language: data.language ?? languageHeader,
            ragFound: data.ragFound ?? ragFoundHeader,
            latencyMs: data.latencyMs ?? 0,
            totalDurationMs: data.totalDurationMs ?? totalDurationHeader,
          })
        }
      }

      fetchDebug().catch(() => null)
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
  }, [botId, isStreaming, onResponseComplete, sessionId])

  // ── Text send ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    void sendToBot({ text })
  }, [input, isStreaming, sendToBot])

  // ── Voice recording ───────────────────────────────────────────────────────

  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          void sendToBot({ text: '', displayText: '🎤 Voice message…', voiceData: base64 })
        }
        reader.readAsDataURL(blob)
        setIsRecording(false)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('[voice]', err)
      setIsRecording(false)
    }
  }, [isRecording, sendToBot])

  // ── Clear conversation ───────────────────────────────────────────────────

  function handleClear() {
    abortRef.current?.abort()
    if (isRecording) mediaRecorderRef.current?.stop()
    setIsStreaming(false)
    setIsRecording(false)
    setInput('')
    setMessages([{ id: 'welcome', role: 'bot', content: defaultWelcome }])
    onSessionReset()
  }

  // ── Render ───────────────────────────────────────────────────────────────

  // Only hide the bot bubble when it has no content yet (TypingIndicator takes over)
  const visibleMessages = messages.filter(m => !(m.streaming && !m.content))
  const waitingForFirstByte =
    isStreaming &&
    messages.at(-1)?.streaming === true &&
    !messages.at(-1)?.content

  return (
    <>
      <style>{`
        @keyframes bb-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-6px); opacity: 1; }
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
            {initialMessages && initialMessages.length > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--bb-primary)' }}
              >
                loaded session
              </span>
            )}
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
          {visibleMessages.map(msg => (
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
                {msg.role === 'bot' ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator — shown while waiting for first byte */}
          {waitingForFirstByte && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--bb-border)', background: 'var(--bb-surface)' }}
        >
          {voiceSupported && (
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
              style={{
                background: isRecording
                  ? 'rgba(239,68,68,0.15)'
                  : 'var(--bb-surface-2)',
                color: isRecording ? 'var(--bb-danger)' : 'var(--bb-text-3)',
                border: `1px solid ${isRecording ? 'rgba(239,68,68,0.3)' : 'var(--bb-border)'}`,
                animation: isRecording ? 'bb-dot-bounce 1s infinite' : 'none',
              }}
              title={isRecording ? 'Stop recording' : 'Record voice message'}
              disabled={isStreaming && !isRecording}
              onClick={handleVoiceToggle}
            >
              {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}

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
            disabled={isStreaming || isRecording}
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
              background: input.trim() && !isStreaming && !isRecording ? 'var(--bb-primary)' : 'var(--bb-surface-3)',
              color: input.trim() && !isStreaming && !isRecording ? '#fff' : 'var(--bb-text-3)',
            }}
            disabled={!input.trim() || isStreaming || isRecording}
            onClick={handleSend}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
