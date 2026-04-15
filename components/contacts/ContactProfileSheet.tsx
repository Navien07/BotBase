'use client'

import { useState } from 'react'
import { X, User, Phone, Mail, Tag, MessageSquare, Calendar, Edit2, Check, Sparkles, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Contact, LeadStage } from '@/types/database'

const STAGE_COLORS: Record<LeadStage, { bg: string; text: string }> = {
  new: { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
  engaged: { bg: 'rgba(34,211,238,0.15)', text: '#22d3ee' },
  qualified: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  booked: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  converted: { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' },
  churned: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
}

const LEAD_STAGES: LeadStage[] = ['new', 'engaged', 'qualified', 'booked', 'converted', 'churned']

interface Conversation {
  id: string
  created_at: string
  channel: string
  language: string
}

interface Booking {
  id: string
  booking_type: string
  service_name: string | null
  start_time: string | null
  status: string
  created_at: string
}

interface Props {
  contact: Contact
  botId: string
  onClose: () => void
  onUpdate: (updated: Contact) => void
}

export function ContactProfileSheet({ contact, botId, onClose, onUpdate }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const [fields, setFields] = useState({
    name: contact.name ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    notes: contact.notes ?? '',
    lead_stage: contact.lead_stage,
  })
  const [newTag, setNewTag] = useState('')
  const [tags, setTags] = useState<string[]>(contact.tags)
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  async function loadHistory() {
    if (historyLoaded) return
    setHistoryLoaded(true)
    try {
      const res = await fetch(`/api/contacts/${botId}/${contact.id}`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations)
        setBookings(data.bookings)
      }
    } catch {
      // non-blocking
    }
  }

  async function fetchAiSummary() {
    if (summaryLoading || aiSummary) return
    setSummaryLoading(true)
    try {
      const res = await fetch(`/api/contacts/${botId}/${contact.id}/summary`)
      if (res.ok) {
        const data = await res.json() as { summary: string | null }
        setAiSummary(data.summary)
      }
    } catch {
      // non-blocking
    } finally {
      setSummaryLoading(false)
    }
  }

  async function save(patch: Partial<typeof fields & { tags: string[] }>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${botId}/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      onUpdate(data.contact)
      toast.success('Contact updated')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function toggleEdit(field: string) {
    setEditing((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  async function commitField(field: keyof typeof fields) {
    await save({ [field]: fields[field] || null })
    toggleEdit(field)
  }

  async function addTag() {
    const tag = newTag.trim()
    if (!tag || tags.includes(tag)) { setNewTag(''); return }
    const next = [...tags, tag]
    setTags(next)
    setNewTag('')
    await save({ tags: next })
  }

  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    await save({ tags: next })
  }

  const initials = (contact.name ?? contact.phone ?? '?').slice(0, 2).toUpperCase()
  const stageMeta = STAGE_COLORS[fields.lead_stage]

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto flex flex-col"
        style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--bb-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>Contact Profile</h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--bb-text-3)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Avatar + stage */}
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
                {contact.name ?? contact.phone ?? contact.email ?? 'Unknown'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: stageMeta.bg, color: stageMeta.text }}
                >
                  {fields.lead_stage}
                </span>
                <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                  Score: {contact.lead_score}
                </span>
              </div>
            </div>
          </div>

          {/* Lead Score bar */}
          <div>
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--bb-text-3)' }}>
              <span>Lead Score</span>
              <span>{contact.lead_score}/100</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--bb-surface-3)' }}>
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${contact.lead_score}%`, background: 'var(--bb-primary)' }}
              />
            </div>
          </div>

          {/* AI Insight */}
          <div
            className="rounded-lg p-3"
            style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--bb-accent)' }}>
                <Sparkles size={11} /> AI Insight
              </span>
              <button
                className="text-xs px-2 py-0.5 rounded transition-colors"
                style={{
                  background: summaryLoading ? 'var(--bb-surface-3)' : 'rgba(34,211,238,0.1)',
                  color: summaryLoading ? 'var(--bb-text-3)' : 'var(--bb-accent)',
                }}
                onClick={fetchAiSummary}
                disabled={summaryLoading}
              >
                {summaryLoading ? 'Analysing…' : aiSummary ? 'Refresh' : 'Generate'}
              </button>
            </div>
            {aiSummary ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--bb-text-2)' }}>{aiSummary}</p>
            ) : (
              <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                {summaryLoading ? 'Generating summary from conversations…' : 'Click Generate to get an AI summary of what this contact asked about.'}
              </p>
            )}
          </div>

          {/* Editable fields */}
          {(['name', 'phone', 'email'] as const).map((field) => {
            const icons = { name: User, phone: Phone, email: Mail }
            const Icon = icons[field]
            return (
              <div key={field}>
                <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--bb-text-3)' }}>{field}</label>
                <div className="flex items-center gap-2">
                  <Icon size={13} style={{ color: 'var(--bb-text-3)', flexShrink: 0 }} />
                  {editing[field] ? (
                    <>
                      <input
                        className="flex-1 text-sm px-2 py-1 rounded outline-none"
                        style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
                        value={fields[field]}
                        onChange={(e) => setFields((p) => ({ ...p, [field]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && commitField(field)}
                        autoFocus
                      />
                      <button onClick={() => commitField(field)} disabled={saving}>
                        <Check size={13} style={{ color: 'var(--bb-success)' }} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm truncate" style={{ color: fields[field] ? 'var(--bb-text-1)' : 'var(--bb-text-3)' }}>
                        {fields[field] || `—`}
                      </span>
                      <button onClick={() => toggleEdit(field)}>
                        <Edit2 size={12} style={{ color: 'var(--bb-text-3)' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {/* Lead Stage */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--bb-text-3)' }}>Lead Stage</label>
            <select
              className="w-full text-sm px-2 py-1.5 rounded outline-none capitalize"
              style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
              value={fields.lead_stage}
              onChange={async (e) => {
                const stage = e.target.value as LeadStage
                setFields((p) => ({ ...p, lead_stage: stage }))
                await save({ lead_stage: stage })
              }}
            >
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs mb-2 block" style={{ color: 'var(--bb-text-3)' }}>
              <Tag size={11} className="inline mr-1" />Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)', border: '1px solid var(--bb-border)' }}
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-red-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs px-2 py-1 rounded outline-none"
                style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
              />
              <button
                onClick={addTag}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--bb-text-3)' }}>Notes</label>
            <textarea
              className="w-full text-sm px-2 py-2 rounded resize-none outline-none"
              rows={3}
              style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
              value={fields.notes}
              onChange={(e) => setFields((p) => ({ ...p, notes: e.target.value }))}
              onBlur={() => save({ notes: fields.notes || undefined })}
              placeholder="Add notes..."
            />
          </div>

          {/* History accordion */}
          <div>
            <button
              onClick={loadHistory}
              className="flex items-center gap-2 text-xs font-medium w-full text-left py-2"
              style={{ color: 'var(--bb-text-2)', borderTop: '1px solid var(--bb-border)' }}
            >
              <MessageSquare size={12} />Recent Conversations
            </button>
            {historyLoaded && (
              <div className="space-y-2 mt-2">
                {conversations === null ? (
                  <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Loading...</p>
                ) : conversations.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>No conversations yet</p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-xs p-2 rounded text-left transition-colors group"
                      style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
                      onClick={() => {
                        onClose()
                        router.push(`/dashboard/bots/${botId}/conversations?id=${c.id}`)
                      }}
                    >
                      <div className="flex items-center justify-between" style={{ color: 'var(--bb-text-2)' }}>
                        <span className="capitalize">{c.channel}</span>
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: 'var(--bb-text-3)' }}>{format(new Date(c.created_at), 'dd MMM yy')}</span>
                          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--bb-primary)' }} />
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                        {c.language.toUpperCase()} · Tap to view
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <button
              onClick={loadHistory}
              className="flex items-center gap-2 text-xs font-medium w-full text-left py-2"
              style={{ color: 'var(--bb-text-2)', borderTop: '1px solid var(--bb-border)' }}
            >
              <Calendar size={12} />Booking History
            </button>
            {historyLoaded && (
              <div className="space-y-2 mt-2">
                {bookings === null ? null : bookings.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>No bookings</p>
                ) : (
                  bookings.map((b) => (
                    <div
                      key={b.id}
                      className="text-xs p-2 rounded"
                      style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
                    >
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--bb-text-1)' }}>{b.service_name ?? b.booking_type}</span>
                        <span
                          className="px-1.5 py-0.5 rounded capitalize"
                          style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
                        >
                          {b.status}
                        </span>
                      </div>
                      {b.start_time && (
                        <p style={{ color: 'var(--bb-text-3)' }}>{format(new Date(b.start_time), 'dd MMM yy, HH:mm')}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
