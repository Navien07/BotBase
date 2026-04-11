'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  Send, Clock, PlusCircle, Radio, Zap,
  CheckCircle, XCircle, AlertCircle, Loader2,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Trash2, Edit3,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string
  name: string
  channel: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  stats: {
    total: number
    sent: number
    delivered: number
    read: number
    replied: number
    failed: number
  }
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
  message_template?: {
    body: string
    media_url: string | null
    buttons: string[]
  }
  audience_filter?: Record<string, unknown>
}

interface FollowupRule {
  id: string
  name: string
  trigger_condition: string
  trigger_hours: number
  max_attempts: number
  is_active: boolean
  pending_count: number
  created_at: string
}

interface QueueEntry {
  id: string
  status: string
  attempt_count: number
  next_attempt_at: string | null
  last_attempt_at: string | null
  contacts: { name: string | null; phone: string | null; channel: string }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    draft:     { label: 'Draft',     color: '#505050' },
    scheduled: { label: 'Scheduled', color: '#3b82f6' },
    sending:   { label: 'Sending',   color: '#f59e0b' },
    sent:      { label: 'Sent',      color: '#22c55e' },
    failed:    { label: 'Failed',    color: '#ef4444' },
    pending:   { label: 'Pending',   color: '#f59e0b' },
    completed: { label: 'Done',      color: '#22c55e' },
    cancelled: { label: 'Cancelled', color: '#505050' },
  }
  const s = map[status] ?? { label: status, color: '#505050' }
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: s.color + '22', color: s.color }}
    >
      {s.label}
    </span>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    whatsapp: '#22c55e',
    telegram: '#3b82f6',
    web:      '#6366f1',
    all:      '#a0a0a0',
  }
  const color = map[channel] ?? '#a0a0a0'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={{ backgroundColor: color + '22', color }}
    >
      {channel}
    </span>
  )
}

// ─── Campaign Composer Sheet ──────────────────────────────────────────────────

function CampaignComposer({
  botId,
  onClose,
  onCreated,
}: {
  botId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [estimatedReach, setEstimatedReach] = useState<number | null>(null)
  const [reachLoading, setReachLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    channel: 'whatsapp',
    message_body: '',
    media_url: '',
    quick_replies: [] as string[],
    // Audience
    lead_stage: [] as string[],
    language: '',
    last_active_days: '',
    // Schedule
    send_mode: 'now',
    scheduled_at: '',
  })

  const [qrInput, setQrInput] = useState('')

  const update = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Fetch estimated reach when audience changes
  const fetchReach = useCallback(async () => {
    setReachLoading(true)
    try {
      const filter: Record<string, unknown> = {}
      if (form.lead_stage.length > 0) filter.lead_stage = form.lead_stage
      if (form.language) filter.language = form.language
      if (form.last_active_days) filter.last_active_days = Number(form.last_active_days)

      const params = new URLSearchParams({ count: 'true', filter: JSON.stringify(filter) })
      const res = await fetch(`/api/contacts/${botId}?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEstimatedReach(data.count ?? 0)
      }
    } catch {
      // ignore
    } finally {
      setReachLoading(false)
    }
  }, [botId, form.lead_stage, form.language, form.last_active_days])

  useEffect(() => {
    if (step === 2) fetchReach()
  }, [step, fetchReach])

  async function handleCreate() {
    setLoading(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        channel: form.channel,
        message_body: form.message_body,
        quick_replies: form.quick_replies,
        audience_filter: {
          ...(form.lead_stage.length > 0 ? { lead_stage: form.lead_stage } : {}),
          ...(form.language ? { language: form.language } : {}),
          ...(form.last_active_days ? { last_active_days: Number(form.last_active_days) } : {}),
        },
      }
      if (form.media_url) body.media_url = form.media_url
      if (form.send_mode === 'schedule' && form.scheduled_at) {
        body.scheduled_at = new Date(form.scheduled_at).toISOString()
      }

      const res = await fetch(`/api/broadcasts/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create campaign')

      // If send now, trigger send
      if (form.send_mode === 'now') {
        await fetch(`/api/broadcasts/${botId}/${data.campaign.id}/send`, { method: 'POST' })
      }

      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const LEAD_STAGES = ['new', 'engaged', 'qualified', 'booked', 'converted', 'churned']

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="h-full w-full max-w-lg flex flex-col overflow-hidden"
        style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--bb-text-1)' }}>
              New Campaign
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
              Step {step} of 3
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded transition-colors"
            style={{ color: 'var(--bb-text-2)', background: 'var(--bb-surface-2)' }}
          >
            Cancel
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
          {['Message', 'Audience', 'Schedule'].map((label, i) => (
            <div key={label} className="flex-1 text-center">
              <div
                className="text-xs font-medium py-1.5 rounded"
                style={{
                  background: step === i + 1 ? 'var(--bb-primary)' : 'var(--bb-surface-2)',
                  color: step === i + 1 ? '#fff' : 'var(--bb-text-2)',
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Step 1: Message */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g. Eid Promotion 2025"
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                  Channel
                </label>
                <select
                  value={form.channel}
                  onChange={(e) => update('channel', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="web">Web</option>
                  <option value="all">All Channels</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                  Message Body * ({form.message_body.length}/4000)
                </label>
                <textarea
                  value={form.message_body}
                  onChange={(e) => update('message_body', e.target.value)}
                  placeholder="Type your broadcast message..."
                  rows={6}
                  maxLength={4000}
                  className="w-full px-3 py-2 rounded text-sm outline-none resize-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                  Media URL (optional)
                </label>
                <input
                  type="url"
                  value={form.media_url}
                  onChange={(e) => update('media_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                  Quick Replies (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && qrInput.trim()) {
                        update('quick_replies', [...form.quick_replies, qrInput.trim()])
                        setQrInput('')
                        e.preventDefault()
                      }
                    }}
                    placeholder="Type and press Enter"
                    className="flex-1 px-3 py-2 rounded text-sm outline-none"
                    style={{
                      background: 'var(--bb-surface-2)',
                      border: '1px solid var(--bb-border)',
                      color: 'var(--bb-text-1)',
                    }}
                  />
                </div>
                {form.quick_replies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.quick_replies.map((qr, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                        style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-1)' }}
                      >
                        {qr}
                        <button
                          onClick={() =>
                            update('quick_replies', form.quick_replies.filter((_, j) => j !== i))
                          }
                          style={{ color: 'var(--bb-text-3)' }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 2: Audience */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--bb-text-2)' }}>
                  Lead Stage (leave empty for all)
                </label>
                <div className="flex flex-wrap gap-2">
                  {LEAD_STAGES.map((stage) => {
                    const checked = form.lead_stage.includes(stage)
                    return (
                      <button
                        key={stage}
                        onClick={() => {
                          update(
                            'lead_stage',
                            checked
                              ? form.lead_stage.filter((s) => s !== stage)
                              : [...form.lead_stage, stage]
                          )
                        }}
                        className="px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors"
                        style={{
                          background: checked ? 'var(--bb-primary)' : 'var(--bb-surface-2)',
                          color: checked ? '#fff' : 'var(--bb-text-2)',
                          border: '1px solid var(--bb-border)',
                        }}
                      >
                        {stage}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                  Language
                </label>
                <select
                  value={form.language}
                  onChange={(e) => update('language', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                >
                  <option value="">All languages</option>
                  <option value="en">English</option>
                  <option value="bm">Bahasa Melayu</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                  Active in last N days
                </label>
                <select
                  value={form.last_active_days}
                  onChange={(e) => update('last_active_days', e.target.value)}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                >
                  <option value="">Any time</option>
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>

              <div
                className="p-4 rounded-lg flex items-center gap-3"
                style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
              >
                {reachLoading ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--bb-primary)' }} />
                ) : (
                  <Radio size={16} style={{ color: 'var(--bb-primary)' }} />
                )}
                <span className="text-sm" style={{ color: 'var(--bb-text-1)' }}>
                  Estimated reach:{' '}
                  <span className="font-semibold" style={{ color: 'var(--bb-primary)' }}>
                    {reachLoading ? '...' : (estimatedReach ?? '—')} contacts
                  </span>
                </span>
              </div>
            </>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--bb-text-2)' }}>
                  When to send?
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'now', label: 'Send Now', icon: Zap },
                    { value: 'schedule', label: 'Schedule for later', icon: Clock },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => update('send_mode', value)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
                      style={{
                        background: form.send_mode === value ? 'rgba(99,102,241,0.1)' : 'var(--bb-surface-2)',
                        border: `1px solid ${form.send_mode === value ? 'var(--bb-primary)' : 'var(--bb-border)'}`,
                        color: 'var(--bb-text-1)',
                      }}
                    >
                      <Icon size={16} style={{ color: form.send_mode === value ? 'var(--bb-primary)' : 'var(--bb-text-2)' }} />
                      <span className="text-sm">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {form.send_mode === 'schedule' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
                    Schedule Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => update('scheduled_at', e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 rounded text-sm outline-none"
                    style={{
                      background: 'var(--bb-surface-2)',
                      border: '1px solid var(--bb-border)',
                      color: 'var(--bb-text-1)',
                    }}
                  />
                </div>
              )}

              {error && (
                <p className="text-sm" style={{ color: 'var(--bb-danger)' }}>{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--bb-border)' }}
        >
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 rounded text-sm transition-colors"
            style={{
              background: 'var(--bb-surface-2)',
              color: step === 1 ? 'var(--bb-text-3)' : 'var(--bb-text-1)',
              opacity: step === 1 ? 0.5 : 1,
            }}
          >
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && (!form.name || !form.message_body))
              }
              className="px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading || (form.send_mode === 'schedule' && !form.scheduled_at)}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{ background: 'var(--bb-primary)', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {form.send_mode === 'now' ? 'Create & Send' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Rule Sheet ───────────────────────────────────────────────────────────────

function FollowupRuleSheet({
  botId,
  onClose,
  onSaved,
}: {
  botId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    trigger_condition: 'no_reply',
    trigger_hours: 24,
    message_template: '',
    max_attempts: 3,
  })

  const update = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/followups/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create rule')
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const TRIGGERS = [
    { value: 'no_reply', label: 'No Reply' },
    { value: 'booking_pending', label: 'Booking Pending' },
    { value: 'lead_stage_change', label: 'Lead Stage Change' },
    { value: 'keyword', label: 'Keyword Match' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="h-full w-full max-w-md flex flex-col overflow-hidden"
        style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <h2 className="font-semibold" style={{ color: 'var(--bb-text-1)' }}>New Follow-up Rule</h2>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded"
            style={{ color: 'var(--bb-text-2)', background: 'var(--bb-surface-2)' }}
          >
            Cancel
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>Rule Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. No-reply 24h nudge"
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>Trigger</label>
            <select
              value={form.trigger_condition}
              onChange={(e) => update('trigger_condition', e.target.value)}
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>Delay (hours)</label>
              <input
                type="number"
                min={1}
                max={720}
                value={form.trigger_hours}
                onChange={(e) => update('trigger_hours', Number(e.target.value))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>Max Attempts</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.max_attempts}
                onChange={(e) => update('max_attempts', Number(e.target.value))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
              Message Template * ({form.message_template.length}/4000)
            </label>
            <textarea
              value={form.message_template}
              onChange={(e) => update('message_template', e.target.value)}
              placeholder="Hi {{name}}, just checking in..."
              rows={5}
              maxLength={4000}
              className="w-full px-3 py-2 rounded text-sm outline-none resize-none"
              style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)' }}
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--bb-danger)' }}>{error}</p>}
        </div>

        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--bb-border)' }}>
          <button
            onClick={handleSave}
            disabled={loading || !form.name || !form.message_template}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium"
            style={{ background: 'var(--bb-primary)', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Create Rule
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Campaign Detail Sheet ────────────────────────────────────────────────────

function CampaignDetail({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const stats = campaign.stats ?? {}
  const total = stats.total || 1 // avoid div by zero

  function pct(n: number) { return Math.round((n / total) * 100) }

  function ProgressBar({ label, count, color }: { label: string; count: number; color: string }) {
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: 'var(--bb-text-2)' }}>{label}</span>
          <span style={{ color: 'var(--bb-text-1)' }}>{count} ({pct(count)}%)</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bb-surface-3)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct(count)}%`, background: color }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="h-full w-full max-w-md flex flex-col overflow-hidden"
        style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--bb-text-1)' }}>{campaign.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <ChannelBadge channel={campaign.channel} />
              <StatusBadge status={campaign.status} />
            </div>
          </div>
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded" style={{ color: 'var(--bb-text-2)', background: 'var(--bb-surface-2)' }}>
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {campaign.status === 'sent' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>Results</h3>
              <ProgressBar label="Sent" count={stats.sent ?? 0} color="#22c55e" />
              <ProgressBar label="Delivered" count={stats.delivered ?? 0} color="#3b82f6" />
              <ProgressBar label="Read" count={stats.read ?? 0} color="#6366f1" />
              <ProgressBar label="Replied" count={stats.replied ?? 0} color="#22d3ee" />
              <ProgressBar label="Failed" count={stats.failed ?? 0} color="#ef4444" />
            </div>
          )}

          {campaign.message_template && (
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--bb-text-1)' }}>Message</h3>
              <div
                className="p-4 rounded-lg text-sm whitespace-pre-wrap"
                style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)', border: '1px solid var(--bb-border)' }}
              >
                {campaign.message_template.body}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--bb-text-1)' }}>Timeline</h3>
            <div className="space-y-1 text-xs" style={{ color: 'var(--bb-text-2)' }}>
              <p>Created: {format(new Date(campaign.created_at), 'dd MMM yyyy HH:mm')}</p>
              {campaign.scheduled_at && (
                <p>Scheduled: {format(new Date(campaign.scheduled_at), 'dd MMM yyyy HH:mm')}</p>
              )}
              {campaign.sent_at && (
                <p>Sent: {format(new Date(campaign.sent_at), 'dd MMM yyyy HH:mm')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
  const params = useParams<{ botId: string }>()
  const botId = params.botId

  const [activeTab, setActiveTab] = useState<'campaigns' | 'followups'>('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [rules, setRules] = useState<FollowupRule[]>([])
  const [loadingC, setLoadingC] = useState(true)
  const [loadingR, setLoadingR] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [showRuleSheet, setShowRuleSheet] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [queueMap, setQueueMap] = useState<Record<string, QueueEntry[]>>({})

  const fetchCampaigns = useCallback(async () => {
    setLoadingC(true)
    try {
      const res = await fetch(`/api/broadcasts/${botId}`)
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns ?? [])
      }
    } finally {
      setLoadingC(false)
    }
  }, [botId])

  const fetchRules = useCallback(async () => {
    setLoadingR(true)
    try {
      const res = await fetch(`/api/followups/${botId}`)
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules ?? [])
      }
    } finally {
      setLoadingR(false)
    }
  }, [botId])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])
  useEffect(() => { fetchRules() }, [fetchRules])

  async function toggleRule(ruleId: string, isActive: boolean) {
    await fetch(`/api/followups/${botId}/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    fetchRules()
  }

  async function expandRule(ruleId: string) {
    if (expandedRule === ruleId) {
      setExpandedRule(null)
      return
    }
    setExpandedRule(ruleId)
    if (!queueMap[ruleId]) {
      const res = await fetch(`/api/followups/${botId}/${ruleId}/queue`)
      if (res.ok) {
        const data = await res.json()
        setQueueMap((m) => ({ ...m, [ruleId]: data.queue ?? [] }))
      }
    }
  }

  async function sendCampaign(campaignId: string) {
    await fetch(`/api/broadcasts/${botId}/${campaignId}/send`, { method: 'POST' })
    setTimeout(fetchCampaigns, 500)
  }

  async function deleteCampaign(campaignId: string) {
    if (!confirm('Delete this draft campaign?')) return
    await fetch(`/api/broadcasts/${botId}/${campaignId}`, { method: 'DELETE' })
    fetchCampaigns()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>Broadcasts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
            Send campaigns and automate follow-ups
          </p>
        </div>
        <button
          onClick={() => activeTab === 'campaigns' ? setShowComposer(true) : setShowRuleSheet(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          <PlusCircle size={15} />
          {activeTab === 'campaigns' ? 'New Campaign' : 'New Rule'}
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0 mb-6"
        style={{ borderBottom: '1px solid var(--bb-border)' }}
      >
        {(['campaigns', 'followups'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium capitalize transition-colors"
            style={{
              color: activeTab === tab ? 'var(--bb-primary)' : 'var(--bb-text-2)',
              borderBottom: activeTab === tab ? '2px solid var(--bb-primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab === 'campaigns' ? 'Campaigns' : 'Follow-ups'}
          </button>
        ))}
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div>
          {loadingC ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--bb-text-3)' }} />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Radio size={36} style={{ color: 'var(--bb-text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>No campaigns yet</p>
              <button
                onClick={() => setShowComposer(true)}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                Create First Campaign
              </button>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--bb-border)' }}
            >
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--bb-surface-2)', borderBottom: '1px solid var(--bb-border)' }}>
                    {['Name', 'Channel', 'Status', 'Reach', 'Sent / Delivered / Read', 'Date', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr
                      key={c.id}
                      className="transition-colors cursor-pointer"
                      style={{
                        background: i % 2 === 0 ? 'transparent' : 'var(--bb-surface-2)',
                        borderBottom: '1px solid var(--bb-border-subtle)',
                      }}
                      onClick={() => setSelectedCampaign(c)}
                    >
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
                        {c.name}
                      </td>
                      <td className="px-4 py-3">
                        <ChannelBadge channel={c.channel} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--bb-text-2)' }}>
                        {c.stats?.total ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--bb-text-2)' }}>
                        {c.stats ? `${c.stats.sent} / ${c.stats.delivered} / ${c.stats.read}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                        {c.sent_at
                          ? format(new Date(c.sent_at), 'dd MMM HH:mm')
                          : c.scheduled_at
                          ? format(new Date(c.scheduled_at), 'dd MMM HH:mm')
                          : format(new Date(c.created_at), 'dd MMM HH:mm')}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {c.status === 'draft' && (
                            <>
                              <button
                                onClick={() => sendCampaign(c.id)}
                                title="Send now"
                                className="p-1.5 rounded transition-colors"
                                style={{ color: 'var(--bb-primary)', background: 'rgba(99,102,241,0.1)' }}
                              >
                                <Send size={13} />
                              </button>
                              <button
                                onClick={() => deleteCampaign(c.id)}
                                title="Delete"
                                className="p-1.5 rounded transition-colors"
                                style={{ color: 'var(--bb-danger)', background: 'rgba(239,68,68,0.1)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                          {c.status === 'sending' && (
                            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--bb-warning)' }} />
                          )}
                          {c.status === 'sent' && (
                            <CheckCircle size={14} style={{ color: 'var(--bb-success)' }} />
                          )}
                          {c.status === 'failed' && (
                            <XCircle size={14} style={{ color: 'var(--bb-danger)' }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Follow-ups Tab */}
      {activeTab === 'followups' && (
        <div>
          {loadingR ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--bb-text-3)' }} />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Zap size={36} style={{ color: 'var(--bb-text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>No follow-up rules yet</p>
              <button
                onClick={() => setShowRuleSheet(true)}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--bb-border)', background: 'var(--bb-surface)' }}
                >
                  {/* Rule row */}
                  <div className="flex items-center gap-4 px-4 py-3">
                    <button
                      onClick={() => expandRule(rule.id)}
                      className="p-1 rounded"
                      style={{ color: 'var(--bb-text-2)' }}
                    >
                      {expandedRule === rule.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
                        {rule.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
                        {rule.trigger_condition.replace(/_/g, ' ')} · {rule.trigger_hours}h delay · max {rule.max_attempts} attempts
                      </p>
                    </div>

                    {rule.pending_count > 0 && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                      >
                        {rule.pending_count} pending
                      </span>
                    )}

                    <button
                      onClick={() => toggleRule(rule.id, rule.is_active)}
                      className="transition-opacity"
                      title={rule.is_active ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.is_active
                        ? <ToggleRight size={20} style={{ color: 'var(--bb-primary)' }} />
                        : <ToggleLeft size={20} style={{ color: 'var(--bb-text-3)' }} />}
                    </button>
                  </div>

                  {/* Queue entries */}
                  {expandedRule === rule.id && (
                    <div style={{ borderTop: '1px solid var(--bb-border)' }}>
                      {!queueMap[rule.id] ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--bb-text-3)' }} />
                        </div>
                      ) : queueMap[rule.id].length === 0 ? (
                        <p className="text-xs text-center py-6" style={{ color: 'var(--bb-text-3)' }}>
                          No queue entries
                        </p>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr style={{ background: 'var(--bb-surface-2)' }}>
                              {['Contact', 'Channel', 'Status', 'Attempts', 'Next At'].map((h) => (
                                <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--bb-text-3)' }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queueMap[rule.id].map((entry) => (
                              <tr
                                key={entry.id}
                                style={{ borderTop: '1px solid var(--bb-border-subtle)' }}
                              >
                                <td className="px-4 py-2 text-xs" style={{ color: 'var(--bb-text-1)' }}>
                                  {entry.contacts?.name ?? entry.contacts?.phone ?? 'Unknown'}
                                </td>
                                <td className="px-4 py-2 text-xs capitalize" style={{ color: 'var(--bb-text-2)' }}>
                                  {entry.contacts?.channel}
                                </td>
                                <td className="px-4 py-2">
                                  <StatusBadge status={entry.status} />
                                </td>
                                <td className="px-4 py-2 text-xs" style={{ color: 'var(--bb-text-2)' }}>
                                  {entry.attempt_count}
                                </td>
                                <td className="px-4 py-2 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                                  {entry.next_attempt_at
                                    ? format(new Date(entry.next_attempt_at), 'dd MMM HH:mm')
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showComposer && (
        <CampaignComposer
          botId={botId}
          onClose={() => setShowComposer(false)}
          onCreated={fetchCampaigns}
        />
      )}

      {showRuleSheet && (
        <FollowupRuleSheet
          botId={botId}
          onClose={() => setShowRuleSheet(false)}
          onSaved={fetchRules}
        />
      )}

      {selectedCampaign && (
        <CampaignDetail
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  )
}
