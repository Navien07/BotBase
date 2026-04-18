'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Send, ThumbsUp, ThumbsDown, Loader2, Bot, Languages } from 'lucide-react'

interface WidgetConfig {
  botName: string
  avatarUrl: string | null
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  bubbleStyle: string
  position: string
  welcomeMessage: string | null
  quickReplies: string[]
  showBranding: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  rating?: 'positive' | 'negative'
  streaming?: boolean
  dbMessageId?: string
}

const LANGUAGES = [
  { code: 'auto', label: 'Auto' },
  { code: 'en', label: 'EN' },
  { code: 'ms', label: 'BM' },
  { code: 'zh', label: 'ZH' },
]

function generateFallbackId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function ChatPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const botId = params.botId as string
  const isWidget = searchParams.get('widget') === 'true'

  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [language, setLanguage] = useState('auto')
  const [configLoading, setConfigLoading] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Init session ID
  useEffect(() => {
    const sessionKey = `bb_session_${botId}`
    const stored = sessionStorage.getItem(sessionKey)
    if (stored) {
      setSessionId(stored)
    } else {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : generateFallbackId()
      sessionStorage.setItem(sessionKey, newId)
      setSessionId(newId)
    }
  }, [botId])

  // Fetch widget config
  useEffect(() => {
    if (!botId) return
    fetch(`/api/widget/${botId}/config`)
      .then(r => r.json())
      .then((data: WidgetConfig) => {
        setConfig(data)
        if (data.welcomeMessage) {
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: data.welcomeMessage,
          }])
        }
      })
      .catch(console.error)
      .finally(() => setConfigLoading(false))
  }, [botId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending || !sessionId) return
    setSending(true)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID?.() ?? generateFallbackId(),
      role: 'user',
      content: text,
    }
    const assistantMsgId = crypto.randomUUID?.() ?? generateFallbackId()
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      streaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')

    try {
      const res = await fetch(`/api/widget/${botId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to send' }))
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: err.error ?? 'Something went wrong.', streaming: false }
            : m
        ))
        return
      }

      const dbMessageId = res.headers.get('X-Message-Id') ?? undefined

      if (res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          const current = accumulated
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: current } : m
          ))
        }

        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, streaming: false, dbMessageId }
            : m
        ))
      } else {
        const text = await res.text()
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: text, streaming: false, dbMessageId }
            : m
        ))
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: 'Something went wrong. Please try again.', streaming: false }
          : m
      ))
    } finally {
      setSending(false)
    }
  }, [botId, sessionId, sending])

  const handleRate = useCallback(async (msg: ChatMessage, rating: 'positive' | 'negative') => {
    if (!msg.dbMessageId || msg.rating) return
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, rating } : m))
    try {
      await fetch(`/api/widget/${botId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msg.dbMessageId, sessionId, rating }),
      })
    } catch {
      // fire-and-forget, don't revert
    }
  }, [botId, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const primaryColor = config?.primaryColor ?? '#6366f1'

  if (configLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#080808' }}>
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#080808' }}>
        <p style={{ color: '#a0a0a0' }}>Bot not found.</p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen"
      style={{
        background: '#080808',
        fontFamily: config.fontFamily + ', Inter, sans-serif',
        color: '#f0f0f0',
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: '#0c0c0c', borderBottom: '1px solid #242424' }}
      >
        <div className="flex items-center gap-3">
          {config.avatarUrl ? (
            <img
              src={config.avatarUrl}
              alt={config.botName}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: primaryColor + '33' }}
            >
              <Bot size={18} style={{ color: primaryColor }} />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: '#f0f0f0' }}>
              {config.botName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs" style={{ color: '#a0a0a0' }}>Online</span>
            </div>
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex items-center gap-1">
          <Languages size={14} style={{ color: '#505050' }} />
          <div className="flex" style={{ border: '1px solid #242424', borderRadius: 6 }}>
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className="px-2 py-1 text-xs transition-colors"
                style={{
                  background: language === lang.code ? primaryColor : 'transparent',
                  color: language === lang.code ? '#fff' : '#a0a0a0',
                  borderRadius: 5,
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
          >
            {msg.role === 'assistant' && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: primaryColor + '33' }}
              >
                <Bot size={14} style={{ color: primaryColor }} />
              </div>
            )}
            <div className="flex flex-col gap-1 max-w-[75%]">
              <div
                className="px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  background: msg.role === 'user' ? primaryColor : '#161616',
                  color: msg.role === 'user' ? '#fff' : '#f0f0f0',
                  borderRadius: config.bubbleStyle === 'rounded'
                    ? (msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px')
                    : '4px',
                  border: msg.role === 'assistant' ? '1px solid #242424' : 'none',
                  minHeight: msg.streaming && !msg.content ? 24 : undefined,
                }}
              >
                {msg.streaming && !msg.content ? (
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                )}
              </div>

              {/* Rating buttons — show after stream completes for assistant messages */}
              {msg.role === 'assistant' && !msg.streaming && msg.content && msg.dbMessageId && (
                <div className="flex gap-1 px-1">
                  <button
                    onClick={() => handleRate(msg, 'positive')}
                    className="p-1 rounded transition-colors"
                    style={{
                      color: msg.rating === 'positive' ? '#22c55e' : '#505050',
                      background: msg.rating === 'positive' ? '#22c55e20' : 'transparent',
                    }}
                    title="Helpful"
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    onClick={() => handleRate(msg, 'negative')}
                    className="p-1 rounded transition-colors"
                    style={{
                      color: msg.rating === 'negative' ? '#ef4444' : '#505050',
                      background: msg.rating === 'negative' ? '#ef444420' : 'transparent',
                    }}
                    title="Not helpful"
                  >
                    <ThumbsDown size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Quick replies — only show after welcome if no other messages */}
        {messages.length === 1 && config.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 px-9">
            {config.quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => sendMessage(qr)}
                className="px-3 py-1.5 text-xs rounded-full border transition-colors"
                style={{
                  border: `1px solid ${primaryColor}66`,
                  color: primaryColor,
                  background: primaryColor + '11',
                }}
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ background: '#0c0c0c', borderTop: '1px solid #242424' }}
      >
        <div
          className="flex items-end gap-2 px-3 py-2 rounded-xl"
          style={{ background: '#161616', border: '1px solid #242424' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm py-1"
            style={{ color: '#f0f0f0', maxHeight: 120, lineHeight: '1.5' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-opacity shrink-0 mb-0.5"
            style={{
              background: primaryColor,
              opacity: !input.trim() || sending ? 0.4 : 1,
            }}
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin text-white" />
            ) : (
              <Send size={14} className="text-white" />
            )}
          </button>
        </div>

        {config.showBranding && (
          <p className="text-center mt-2 text-xs" style={{ color: '#505050' }}>
            Powered by{' '}
            <span style={{ color: '#a0a0a0' }}>IceBot</span>
          </p>
        )}
      </div>
    </div>
  )
}
