'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'
import type { BotFeatureFlags, BookingType } from '@/types/database'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BotSettings {
  id: string
  name: string
  slug: string
  timezone: string
  default_language: 'en' | 'bm' | 'zh'
  feature_flags: BotFeatureFlags
  is_active: boolean
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES = [
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
]

const DEFAULT_FLAGS: BotFeatureFlags = {
  booking_enabled: false,
  booking_type: 'appointment',
  crm_enabled: true,
  broadcasts_enabled: false,
  flow_builder_enabled: false,
  pdf_delivery_enabled: false,
  widget_enabled: false,
  voice_enabled: false,
}

const FLAG_CARDS: {
  key: keyof Omit<BotFeatureFlags, 'booking_type'>
  label: string
  desc: string
}[] = [
  { key: 'booking_enabled',      label: 'Booking',        desc: 'Appointment, table & property booking' },
  { key: 'crm_enabled',          label: 'CRM',            desc: 'Contacts, lead scoring & pipeline' },
  { key: 'broadcasts_enabled',   label: 'Broadcasts',     desc: 'Bulk messaging & drip campaigns' },
  { key: 'flow_builder_enabled', label: 'Flow Builder',   desc: 'Visual conversation flow designer' },
  { key: 'pdf_delivery_enabled', label: 'PDF Delivery',   desc: 'Send product PDFs & brochures' },
  { key: 'widget_enabled',       label: 'Web Widget',     desc: 'Embeddable chat widget for websites' },
  { key: 'voice_enabled',        label: 'Voice',          desc: 'Voice channel support (beta)' },
]

const BOOKING_TYPES: { value: BookingType; label: string; desc: string }[] = [
  { value: 'appointment',      label: 'Appointment',      desc: 'Service-based bookings with time slots' },
  { value: 'table',            label: 'Table Reservation', desc: 'Restaurant & F&B table booking' },
  { value: 'property_viewing', label: 'Property Viewing', desc: 'Real estate viewing appointments' },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--bb-text-2)' }}>
      {children}
    </p>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
      {children}{required && <span style={{ color: 'var(--bb-danger)' }}> *</span>}
    </label>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative rounded-full transition-colors flex-shrink-0"
      style={{ background: value ? 'var(--bb-primary)' : 'var(--bb-surface-3)', width: '40px', height: '22px' }}
    >
      <span
        className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform"
        style={{ width: '18px', height: '18px', transform: value ? 'translateX(18px)' : 'translateX(0)' }}
      />
    </button>
  )
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ botName, onConfirm, onCancel, deleting }: {
  botName: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  const [confirmName, setConfirmName] = useState('')
  const matches = confirmName === botName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="rounded-xl border p-6 w-full max-w-sm mx-4"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-danger)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--bb-danger)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>Delete Bot</h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--bb-text-3)' }}>
          This will permanently delete <strong style={{ color: 'var(--bb-text-1)' }}>{botName}</strong> and
          all associated data — conversations, contacts, knowledge, and bookings. This cannot be undone.
        </p>
        <p className="text-xs mb-2" style={{ color: 'var(--bb-text-2)' }}>
          Type <strong>{botName}</strong> to confirm
        </p>
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={botName}
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none mb-4"
          style={{
            background: 'var(--bb-surface-2)',
            borderColor: matches ? 'var(--bb-danger)' : 'var(--bb-border)',
            color: 'var(--bb-text-1)',
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)', background: 'var(--bb-surface-2)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-40"
            style={{ background: 'var(--bb-danger)', color: '#fff' }}
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {deleting ? 'Deleting...' : 'Delete Bot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const botId = params.botId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [settings, setSettings] = useState<BotSettings>({
    id: '',
    name: '',
    slug: '',
    timezone: 'Asia/Kuala_Lumpur',
    default_language: 'en',
    feature_flags: { ...DEFAULT_FLAGS },
    is_active: true,
  })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/config/${botId}/settings`)
      const data = await res.json() as { settings?: BotSettings; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to load'); return }
      if (data.settings) setSettings(data.settings)
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { load() }, [load])

  function setField<K extends keyof BotSettings>(key: K, value: BotSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function setFlag<K extends keyof BotFeatureFlags>(key: K, value: BotFeatureFlags[K]) {
    setSettings((prev) => ({
      ...prev,
      feature_flags: { ...prev.feature_flags, [key]: value },
    }))
  }

  async function handleSave() {
    if (!settings.name.trim()) { toast.error('Bot name is required'); return }
    if (!settings.slug.trim()) { toast.error('Slug is required'); return }
    if (!/^[a-z0-9-]+$/.test(settings.slug)) {
      toast.error('Slug must be lowercase alphanumeric with hyphens only')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          slug: settings.slug,
          timezone: settings.timezone,
          default_language: settings.default_language,
          feature_flags: settings.feature_flags,
        }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }
      toast.success('Settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/config/${botId}/settings`, { method: 'DELETE' })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Delete failed'); return }
      toast.success('Bot deleted')
      router.push('/dashboard/overview')
    } catch {
      toast.error('Network error')
    } finally {
      setDeleting(false)
    }
  }

  const inputStyle = {
    background: 'var(--bb-surface-2)',
    borderColor: 'var(--bb-border)',
    color: 'var(--bb-text-1)',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: 'var(--bb-text-3)' }}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 pb-10">

      {/* General */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>General</SectionHeader>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <FieldLabel required>Bot Name</FieldLabel>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setField('name', e.target.value)}
              maxLength={100}
              placeholder="e.g. Ask Ethan"
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel required>Slug</FieldLabel>
            <input
              type="text"
              value={settings.slug}
              onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              maxLength={100}
              placeholder="e.g. ask-ethan"
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 font-mono"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bb-text-3)' }}>lowercase, hyphens only</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Default Language</FieldLabel>
            <select
              value={settings.default_language}
              onChange={(e) => setField('default_language', e.target.value as 'en' | 'bm' | 'zh')}
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none appearance-none"
              style={inputStyle}
            >
              <option value="en">English</option>
              <option value="bm">Bahasa Malaysia</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <div>
            <FieldLabel>Timezone</FieldLabel>
            <select
              value={settings.timezone}
              onChange={(e) => setField('timezone', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none appearance-none"
              style={inputStyle}
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Feature Flags */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Features</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          {FLAG_CARDS.map(({ key, label, desc }) => {
            const enabled = settings.feature_flags[key] as boolean
            return (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-xl border transition-all"
                style={{
                  background: enabled ? 'rgba(99,102,241,0.06)' : 'var(--bb-surface-2)',
                  borderColor: enabled ? 'rgba(99,102,241,0.3)' : 'var(--bb-border)',
                }}
              >
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>{label}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--bb-text-3)' }}>{desc}</p>
                </div>
                <Toggle value={enabled} onChange={(v) => setFlag(key, v)} />
              </div>
            )
          })}
        </div>

        {/* Booking type — shown only when booking enabled */}
        {settings.feature_flags.booking_enabled && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--bb-border-subtle)' }}>
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--bb-text-2)' }}>Booking Type</p>
            <div className="grid grid-cols-3 gap-3">
              {BOOKING_TYPES.map(({ value, label, desc }) => {
                const active = settings.feature_flags.booking_type === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFlag('booking_type', value)}
                    className="rounded-xl border p-3 text-left transition-all"
                    style={{
                      background: active ? 'rgba(99,102,241,0.08)' : 'var(--bb-surface-2)',
                      borderColor: active ? 'var(--bb-primary)' : 'var(--bb-border)',
                      borderWidth: active ? '2px' : '1px',
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: active ? 'var(--bb-primary)' : 'var(--bb-text-1)' }}>
                      {label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>{desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Danger Zone */}
      <section
        className="rounded-xl border p-6"
        style={{ background: 'var(--bb-surface)', borderColor: 'rgba(239,68,68,0.3)' }}
      >
        <SectionHeader>Danger Zone</SectionHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>Delete this bot</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
              Permanently delete all data — conversations, contacts, knowledge, bookings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex-shrink-0 ml-6 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--bb-danger)', color: 'var(--bb-danger)', background: 'rgba(239,68,68,0.06)' }}
          >
            Delete Bot
          </button>
        </div>
      </section>

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal
          botName={settings.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
