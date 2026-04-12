'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  Bell, PlusCircle, Loader2, Zap,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  contacts: { name: string | null; phone: string | null; channel: string }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:   { label: 'Pending',   color: '#f59e0b' },
    completed: { label: 'Done',      color: '#22c55e' },
    cancelled: { label: 'Cancelled', color: '#505050' },
    failed:    { label: 'Failed',    color: '#ef4444' },
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FollowupsPage() {
  const params = useParams<{ botId: string }>()
  const botId = params.botId

  const [rules, setRules] = useState<FollowupRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showRuleSheet, setShowRuleSheet] = useState(false)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [queueMap, setQueueMap] = useState<Record<string, QueueEntry[]>>({})

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/followups/${botId}`)
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [botId])

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>Follow-ups</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
            Automated follow-up rules triggered by contact behaviour
          </p>
        </div>
        <button
          onClick={() => setShowRuleSheet(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          <PlusCircle size={15} />
          New Rule
        </button>
      </div>

      {/* Content */}
      {loading ? (
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
                          <tr key={entry.id} style={{ borderTop: '1px solid var(--bb-border-subtle)' }}>
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

      {showRuleSheet && (
        <FollowupRuleSheet
          botId={botId}
          onClose={() => setShowRuleSheet(false)}
          onSaved={fetchRules}
        />
      )}
    </div>
  )
}
