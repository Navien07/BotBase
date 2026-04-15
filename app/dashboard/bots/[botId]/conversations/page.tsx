'use client'

import { useState, useEffect, useRef, useCallback, use, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow, format, isToday } from 'date-fns'
import {
  MessageSquare, Search, User, Send, UserCheck, UserX,
  Wifi, Phone, Filter, Bug, X, Sparkles, CheckCircle, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { MessageBubble, type MessageData } from '@/components/conversation/MessageBubble'
import { EmptyState } from '@/components/shared/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationContact {
  id: string
  name: string | null
  phone: string | null
  channel: string
}

interface ConversationSummary {
  id: string
  last_message_at: string | null
  status: 'open' | 'closed'
  agent_id: string | null
  channel: string
  language: string
  created_at: string
  contact: ConversationContact | null
  last_message: { role: string; content: string } | null
  unread_count: number
}

interface AgentSession {
  id: string
  agent_id: string
  started_at: string
  is_active: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '📱', telegram: '✈️', web_widget: '🌐',
  instagram: '📷', facebook: '📘', api: '🔗',
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WA', telegram: 'TG', web_widget: 'Web',
}

function relativeTime(ts: string | null): string {
  if (!ts) return ''
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) }
  catch { return '' }
}

function absTime(ts: string | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd MMM')
  } catch { return '' }
}

function dateGroupLabel(ts: string | null): string {
  if (!ts) return 'Unknown'
  try {
    const d = new Date(ts)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return format(d, 'EEEE') // e.g. "Monday"
    return format(d, 'dd MMM yyyy')
  } catch { return 'Unknown' }
}

function contactName(contact: ConversationContact | null, channel: string): string {
  if (contact?.name) return contact.name
  if (contact?.phone) return contact.phone
  return `${channel.charAt(0).toUpperCase()}${channel.slice(1)} User`
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({
  conv, isSelected, onClick,
}: {
  conv: ConversationSummary
  isSelected: boolean
  onClick: () => void
}) {
  const name = contactName(conv.contact, conv.channel)
  const icon = CHANNEL_ICONS[conv.channel] ?? '💬'

  return (
    <button
      className="w-full text-left px-4 py-3 transition-colors"
      style={{
        background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
        borderLeft: isSelected ? '3px solid var(--bb-primary)' : '3px solid transparent',
        borderBottom: '1px solid var(--bb-border-subtle)',
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
              {name}
            </span>
            <div className="flex flex-col items-end gap-0 flex-shrink-0">
              <span className="text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>
                {absTime(conv.last_message_at)}
              </span>
              <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                {relativeTime(conv.last_message_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs">{icon}</span>
            <span className="text-xs truncate" style={{ color: 'var(--bb-text-2)' }}>
              {conv.last_message
                ? (conv.last_message.role !== 'user' ? '↩ ' : '') + conv.last_message.content
                : 'No messages yet'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: conv.status === 'open' ? 'rgba(34,197,94,0.1)' : 'rgba(80,80,80,0.25)',
                color: conv.status === 'open' ? 'var(--bb-success)' : 'var(--bb-text-3)',
              }}
            >
              {conv.status}
            </span>
            {conv.agent_id && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
              >
                Needs agent
              </span>
            )}
            {conv.unread_count > 0 && (
              <span
                className="text-xs px-1.5 rounded-full font-medium"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                {conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Filters Dropdown ─────────────────────────────────────────────────────────

interface ActiveFilters {
  language: string
}

function FiltersDropdown({
  filters, onChange, onClose,
}: {
  filters: ActiveFilters
  onChange: (f: ActiveFilters) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute top-full right-0 mt-1 w-56 rounded-lg shadow-xl z-20 p-3 flex flex-col gap-3"
      style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>Filters</span>
        <button onClick={onClose}><X size={13} style={{ color: 'var(--bb-text-3)' }} /></button>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Language</label>
        <select
          className="rounded px-2 py-1 text-xs outline-none"
          style={{
            background: 'var(--bb-surface-3)',
            border: '1px solid var(--bb-border)',
            color: 'var(--bb-text-1)',
          }}
          value={filters.language}
          onChange={e => onChange({ ...filters, language: e.target.value })}
        >
          <option value="">All</option>
          <option value="en">English</option>
          <option value="bm">Bahasa Melayu</option>
          <option value="zh">Chinese</option>
        </select>
      </div>

      <button
        className="text-xs py-1 rounded transition-colors"
        style={{ color: 'var(--bb-text-3)', background: 'var(--bb-surface-3)' }}
        onClick={() => onChange({ language: '' })}
      >
        Clear filters
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConversationsPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = use(params)
  const searchParams = useSearchParams()

  // ── Auth / profile ─────────────────────────────────────────────────────────
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  // ── Conversation list state ─────────────────────────────────────────────────
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [totalConvs, setTotalConvs] = useState(0)
  const [listLoading, setListLoading] = useState(true)

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'telegram' | 'web_widget'>('all')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ language: '' })
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Thread state ────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedConv, setSelectedConv] = useState<ConversationSummary | null>(null)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)

  // ── Message input ───────────────────────────────────────────────────────────
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [takingOver, setTakingOver] = useState(false)

  // ── AI summary ──────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Init: get user + profile ───────────────────────────────────────────────
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      // Use /api/auth/me — direct profiles query fails with RLS using anon client
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const me = await res.json() as { role?: string }
        if (me.role === 'super_admin') setIsSuperAdmin(true)
      }
    })
  }, [])

  // ── Debounce search input ──────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchInput])

  // ── Fetch conversation list ────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setListLoading(true)
    try {
      const qs = new URLSearchParams({ status: statusFilter, channel: channelFilter, limit: '30' })
      if (debouncedSearch) qs.set('search', debouncedSearch)
      if (activeFilters.language) qs.set('language', activeFilters.language)
      const res = await fetch(`/api/conversations/${botId}?${qs}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json() as { conversations: ConversationSummary[]; total: number }
      setConversations(json.conversations)
      setTotalConvs(json.total)
    } catch {
      toast.error('Could not load conversations')
    } finally {
      setListLoading(false)
    }
  }, [botId, statusFilter, channelFilter, debouncedSearch, activeFilters])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Poll conversation list every 10s for new conversations
  useEffect(() => {
    const timer = setInterval(() => { fetchConversations() }, 10000)
    return () => clearInterval(timer)
  }, [fetchConversations])

  // Auto-select conversation from ?id= query param
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id || conversations.length === 0 || selectedId) return
    const match = conversations.find(c => c.id === id)
    if (match) handleSelectConversation(match)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, searchParams])

  // ── Fetch thread ──────────────────────────────────────────────────────────
  const fetchThread = useCallback(async (convId: string) => {
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/conversations/${botId}/${convId}`)
      if (!res.ok) throw new Error('Failed to load thread')
      const json = await res.json() as {
        conversation: Record<string, unknown>
        messages: MessageData[]
        agent_session: AgentSession | null
      }
      setMessages(json.messages)
      setAgentSession(json.agent_session)
    } catch {
      toast.error('Could not load conversation')
    } finally {
      setThreadLoading(false)
    }
  }, [botId])

  useEffect(() => {
    if (!selectedId) return
    fetchThread(selectedId)
    setSummary(null)
  }, [selectedId, fetchThread])

  // Auto-summarize when thread loads
  useEffect(() => {
    if (messages.length > 0 && !summary && !summaryLoading) {
      fetchSummary()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length > 0 ? selectedId : null])

  // ── 1s silent poll: append new messages without loading flicker ────────────
  useEffect(() => {
    if (!selectedId) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/conversations/${botId}/${selectedId}`)
        if (!res.ok) return
        const json = await res.json() as { messages: MessageData[]; agent_session: AgentSession | null }
        setMessages(prev => {
          if (json.messages.length <= prev.length) return prev
          return json.messages
        })
        setAgentSession(json.agent_session)
      } catch { /* ignore */ }
    }, 1000)
    return () => clearInterval(timer)
  }, [selectedId, botId])

  // ── fetchSummary ───────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    if (!selectedId) return
    setSummaryLoading(true)
    try {
      const res = await fetch(`/api/conversations/${botId}/${selectedId}/summary`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json() as { summary: string }
      setSummary(json.summary)
    } catch {
      toast.error('Could not generate summary')
    } finally {
      setSummaryLoading(false)
    }
  }, [botId, selectedId])

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return
    const sb = createClient()
    const channel = sb
      .channel(`conv:${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, (payload) => {
        setMessages(prev => {
          const newMsg = payload.new as MessageData
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [selectedId])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleSelectConversation(conv: ConversationSummary) {
    setSelectedId(conv.id)
    setSelectedConv(conv)
    setMessages([])
    setAgentSession(null)
    setMessageInput('')
  }

  async function handleTakeOver() {
    if (!selectedId) return
    setTakingOver(true)
    try {
      const res = await fetch(`/api/conversations/${botId}/${selectedId}/takeover`, { method: 'POST' })
      if (!res.ok) throw new Error('Takeover failed')
      const { session } = await res.json() as { session: AgentSession }
      setAgentSession(session)
      setConversations(prev => prev.map(c =>
        c.id === selectedId ? { ...c, agent_id: session.agent_id, status: 'open' } : c
      ))
      toast.success('You have taken over this conversation')
    } catch {
      toast.error('Could not take over conversation')
    } finally {
      setTakingOver(false)
    }
  }

  async function handleResolve(newStatus: 'closed' | 'open') {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/conversations/${botId}/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Update failed')
      setSelectedConv(prev => prev ? { ...prev, status: newStatus } : prev)
      setConversations(prev => prev.map(c =>
        c.id === selectedId ? { ...c, status: newStatus } : c
      ))
      toast.success(newStatus === 'closed' ? 'Conversation resolved' : 'Conversation reopened')
    } catch {
      toast.error('Could not update conversation status')
    }
  }

  async function handleRelease() {
    if (!selectedId) return
    setTakingOver(true)
    try {
      const res = await fetch(`/api/conversations/${botId}/${selectedId}/takeover`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Release failed')
      setAgentSession(null)
      setConversations(prev => prev.map(c =>
        c.id === selectedId ? { ...c, agent_id: null } : c
      ))
      toast.success('Conversation released — bot will resume')
    } catch {
      toast.error('Could not release conversation')
    } finally {
      setTakingOver(false)
    }
  }

  async function handleSendMessage() {
    if (!selectedId || !messageInput.trim()) return
    setSending(true)
    const content = messageInput.trim()
    setMessageInput('')

    const tempMsg: MessageData = {
      id: `temp-${Date.now()}`,
      role: 'assistant',
      content,
      intent: null,
      sentiment: null,
      pipeline_debug: {},
      metadata: { sent_by_agent: true, agent_id: currentUserId ?? undefined },
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const res = await fetch(`/api/conversations/${botId}/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('Send failed')
      const { message } = await res.json() as { message: MessageData }
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? message : m))
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
      setMessageInput(content)
      toast.error('Could not send message')
    } finally {
      setSending(false)
    }
  }

  const mySessionActive = agentSession?.is_active === true && agentSession.agent_id === currentUserId
  const hasActiveFilters = !!activeFilters.language

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="grid overflow-hidden"
      style={{
        gridTemplateColumns: '320px 1fr',
        height: 'calc(100vh - 200px)',
        minHeight: '520px',
      }}
    >
      {/* ── Left Pane ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-col border-r overflow-hidden"
        style={{ borderColor: 'var(--bb-border)', background: 'var(--bb-surface)' }}
      >
        {/* Search row */}
        <div className="p-3 pb-0">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
          >
            <Search size={13} style={{ color: 'var(--bb-text-3)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search contacts…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--bb-text-1)' }}
            />
          </div>
        </div>

        {/* Channel filter tabs + Filters button */}
        <div
          className="flex items-center gap-0 px-3 pt-2 pb-0 relative"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          {([
            { key: 'all', label: 'All' },
            { key: 'whatsapp', label: '📱 WA' },
            { key: 'telegram', label: '✈️ TG' },
            { key: 'web_widget', label: '🌐 Web' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              className="px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                color: channelFilter === key ? 'var(--bb-primary)' : 'var(--bb-text-3)',
                borderBottom: channelFilter === key
                  ? '2px solid var(--bb-primary)'
                  : '2px solid transparent',
                marginBottom: '-1px',
              }}
              onClick={() => setChannelFilter(key)}
            >
              {label}
            </button>
          ))}

          {/* Spacer */}
          <span className="flex-1" />

          {/* Filters button */}
          <div className="relative">
            <button
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs mb-1 transition-colors"
              style={{
                color: hasActiveFilters ? 'var(--bb-primary)' : 'var(--bb-text-3)',
                background: hasActiveFilters ? 'rgba(99,102,241,0.08)' : 'transparent',
              }}
              onClick={() => setShowFiltersDropdown(v => !v)}
            >
              <Filter size={11} />
              Filters
              {hasActiveFilters && (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--bb-primary)' }}
                />
              )}
            </button>
            {showFiltersDropdown && (
              <FiltersDropdown
                filters={activeFilters}
                onChange={f => { setActiveFilters(f); setShowFiltersDropdown(false) }}
                onClose={() => setShowFiltersDropdown(false)}
              />
            )}
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--bb-border)' }}>
          {(['all', 'open', 'closed'] as const).map(s => (
            <button
              key={s}
              className="flex-1 py-2 text-xs font-medium capitalize transition-colors"
              style={{
                color: statusFilter === s ? 'var(--bb-primary)' : 'var(--bb-text-2)',
                borderBottom: statusFilter === s ? '2px solid var(--bb-primary)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Count */}
        {!listLoading && (
          <div className="px-4 py-1.5 text-xs" style={{ color: 'var(--bb-text-3)' }}>
            {totalConvs} conversation{totalConvs !== 1 ? 's' : ''}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading…</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={MessageSquare}
                title="No conversations yet"
                description="Share your bot link to start chatting"
              />
            </div>
          ) : (
            (() => {
              const items: ReactNode[] = []
              let lastGroup = ''
              conversations.forEach(conv => {
                const group = dateGroupLabel(conv.last_message_at)
                if (group !== lastGroup) {
                  lastGroup = group
                  items.push(
                    <div
                      key={`group-${group}`}
                      className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider sticky top-0"
                      style={{ color: 'var(--bb-text-3)', background: 'var(--bb-surface)', borderBottom: '1px solid var(--bb-border-subtle)' }}
                    >
                      {group}
                    </div>
                  )
                }
                items.push(
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    isSelected={conv.id === selectedId}
                    onClick={() => handleSelectConversation(conv)}
                  />
                )
              })
              return items
            })()
          )}
        </div>
      </div>

      {/* ── Right Pane ────────────────────────────────────────────────── */}
      {!selectedId ? (
        <div
          className="flex flex-col items-center justify-center gap-4"
          style={{ background: 'var(--bb-bg)', color: 'var(--bb-text-3)' }}
        >
          <MessageSquare size={48} style={{ opacity: 0.2 }} />
          <p className="text-sm">Select a conversation to view messages</p>
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden" style={{ background: 'var(--bb-bg)' }}>
          {/* Thread header */}
          <div
            className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0"
            style={{ borderColor: 'var(--bb-border)', background: 'var(--bb-surface)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
            >
              {contactName(selectedConv?.contact ?? null, selectedConv?.channel ?? '').charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: 'var(--bb-text-1)' }}>
                  {contactName(selectedConv?.contact ?? null, selectedConv?.channel ?? '')}
                </span>
                {selectedConv?.contact?.phone && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                    <Phone size={10} /> {selectedConv.contact.phone}
                  </span>
                )}
                {selectedConv?.language && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded uppercase"
                    style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-3)' }}
                  >
                    {selectedConv.language}
                  </span>
                )}
                {selectedConv?.channel && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
                  >
                    {CHANNEL_ICONS[selectedConv.channel]} {CHANNEL_LABELS[selectedConv.channel] ?? selectedConv.channel}
                  </span>
                )}
                {mySessionActive && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}
                  >
                    <Wifi size={10} /> Live
                  </span>
                )}
              </div>
              {/* Session + date muted sub-line */}
              <div className="flex items-center gap-2 mt-0.5">
                {agentSession && (
                  <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
                    session {agentSession.id.slice(0, 8)}
                  </span>
                )}
                {selectedConv?.created_at && (
                  <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                    started {format(new Date(selectedConv.created_at), 'dd MMM yyyy · HH:mm')}
                  </span>
                )}
              </div>
            </div>

            {/* AI Summarize button */}
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0"
              style={{
                background: summary ? 'rgba(34,211,238,0.08)' : 'var(--bb-surface-2)',
                color: summary ? 'var(--bb-accent)' : 'var(--bb-text-3)',
                border: `1px solid ${summary ? 'rgba(34,211,238,0.2)' : 'var(--bb-border)'}`,
              }}
              title="Generate AI summary of this conversation"
              onClick={fetchSummary}
              disabled={summaryLoading}
            >
              <Sparkles size={12} />
              {summaryLoading ? 'Summarizing…' : 'Summarize'}
            </button>

            {/* Debug mode toggle (super admin only) */}
            {isSuperAdmin && (
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  background: debugMode ? 'rgba(99,102,241,0.12)' : 'var(--bb-surface-2)',
                  color: debugMode ? 'var(--bb-primary)' : 'var(--bb-text-3)',
                  border: `1px solid ${debugMode ? 'rgba(99,102,241,0.3)' : 'var(--bb-border)'}`,
                }}
                title="Debug mode — shows pipeline tab by default"
                onClick={() => setDebugMode(v => !v)}
              >
                <Bug size={12} />
                Debug
              </button>
            )}

            {/* Mark as Resolved / Reopen */}
            {selectedConv?.status === 'open' ? (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--bb-success)' }}
                onClick={() => handleResolve('closed')}
                title="Mark conversation as resolved"
              >
                <CheckCircle size={14} /> Resolve
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)', border: '1px solid var(--bb-border)' }}
                onClick={() => handleResolve('open')}
                title="Reopen conversation"
              >
                <RotateCcw size={14} /> Reopen
              </button>
            )}

            {/* Take Over / Release */}
            {mySessionActive ? (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                onClick={handleRelease}
                disabled={takingOver}
              >
                <UserX size={14} /> Release
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
                onClick={handleTakeOver}
                disabled={takingOver}
              >
                <UserCheck size={14} /> Take Over
              </button>
            )}
          </div>

          {/* AI Summary strip */}
          {summary && (
            <div
              className="flex items-start gap-2 px-5 py-2 text-xs flex-shrink-0"
              style={{
                background: 'rgba(34,211,238,0.05)',
                borderBottom: '1px solid rgba(34,211,238,0.12)',
                color: 'var(--bb-text-2)',
              }}
            >
              <Sparkles size={11} style={{ color: 'var(--bb-accent)', marginTop: 1, flexShrink: 0 }} />
              <span>{summary}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {threadLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading messages…</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <User size={32} style={{ color: 'var(--bb-text-3)', opacity: 0.4 }} />
                <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>No messages yet</span>
              </div>
            ) : (
              messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  showDebugByDefault={debugMode}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Agent message input — only when active session */}
          {mySessionActive && (
            <div
              className="flex items-end gap-3 px-4 py-3 border-t flex-shrink-0"
              style={{ borderColor: 'var(--bb-border)', background: 'var(--bb-surface)' }}
            >
              <textarea
                className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--bb-surface-2)',
                  border: '1px solid var(--bb-border)',
                  color: 'var(--bb-text-1)',
                  minHeight: '40px',
                  maxHeight: '120px',
                }}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                rows={1}
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
              />
              <button
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  background: messageInput.trim() ? 'var(--bb-primary)' : 'var(--bb-surface-3)',
                  color: messageInput.trim() ? '#fff' : 'var(--bb-text-3)',
                }}
                onClick={handleSendMessage}
                disabled={sending || !messageInput.trim()}
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
