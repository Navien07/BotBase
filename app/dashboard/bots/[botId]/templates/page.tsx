'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ResponseTemplate {
  id: string
  intent: string
  language: 'en' | 'bm' | 'zh'
  content: string
  format: string
}

type LangTab = 'en' | 'bm' | 'zh'

// ─── Constants ─────────────────────────────────────────────────────────────────

const INTENTS = [
  { key: 'general',          label: 'General',            desc: 'Default responses' },
  { key: 'faq',              label: 'FAQ',                 desc: 'Frequently asked questions' },
  { key: 'browse_product',   label: 'Browse Product',      desc: 'Product discovery' },
  { key: 'health_issue',     label: 'Health Issue',        desc: 'Health-related queries' },
  { key: 'book_session',     label: 'Book Session',        desc: 'Booking initiation' },
  { key: 'booking_intent',   label: 'Booking Intent',      desc: 'Booking confirmation' },
  { key: 'cancel_booking',   label: 'Cancel Booking',      desc: 'Cancellation flow' },
  { key: 'check_booking',    label: 'Check Booking',       desc: 'Booking status inquiry' },
]

const FORMATS = [
  { value: 'text',           label: 'Plain Text' },
  { value: 'bullet_list',    label: 'Bullet List' },
  { value: 'numbered_list',  label: 'Numbered List' },
  { value: 'card',           label: 'Card' },
]

const LANG_TABS: { key: LangTab; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'bm', label: 'Bahasa Malaysia' },
  { key: 'zh', label: '中文' },
]

const THEME_PRESETS = [
  { id: 'indigo',  label: 'Indigo',   primary: '#6366f1', secondary: '#22d3ee' },
  { id: 'emerald', label: 'Emerald',  primary: '#10b981', secondary: '#6366f1' },
  { id: 'rose',    label: 'Rose',     primary: '#f43f5e', secondary: '#fb923c' },
  { id: 'amber',   label: 'Amber',    primary: '#f59e0b', secondary: '#22c55e' },
]

const FONT_OPTIONS = [
  { value: 'Inter',        label: 'Inter' },
  { value: 'Geist',        label: 'Geist' },
  { value: 'Poppins',      label: 'Poppins' },
  { value: 'DM Sans',      label: 'DM Sans' },
]

const ANIMATION_OPTIONS = [
  { value: 'step',     label: 'Step-by-step',  desc: 'Shows each word appearing sequentially' },
  { value: 'progress', label: 'Progress Bar',   desc: 'Shows a progress indicator while generating' },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--bb-text-2)' }}>
      {children}
    </p>
  )
}

// ─── Template row ──────────────────────────────────────────────────────────────

interface TemplateRowProps {
  intent: { key: string; label: string; desc: string }
  template: { content: string; format: string } | undefined
  saving: string | null
  onSave: (intent: string, content: string, format: string) => void
}

function TemplateRow({ intent, template, saving, onSave }: TemplateRowProps) {
  const [content, setContent] = useState(template?.content ?? '')
  const [format, setFormat] = useState(template?.format ?? 'text')
  const isSaving = saving === intent.key

  // Sync when template prop changes (tab switch)
  useEffect(() => {
    setContent(template?.content ?? '')
    setFormat(template?.format ?? 'text')
  }, [template])

  const inputStyle = {
    background: 'var(--bb-surface-2)',
    borderColor: 'var(--bb-border)',
    color: 'var(--bb-text-1)',
  }

  return (
    <div
      className="p-4 rounded-xl border"
      style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>{intent.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>{intent.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs border outline-none appearance-none"
            style={inputStyle}
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onSave(intent.key, content, format)}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={`Template for ${intent.label.toLowerCase()} responses… (leave blank to use AI default)`}
        className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 resize-y"
        style={inputStyle}
      />
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const params = useParams()
  const botId = params.botId as string

  const [tab, setTab] = useState<LangTab>('en')
  const [templates, setTemplates] = useState<ResponseTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Chat UI theme (stored in localStorage — persisted to widget when widget module ships)
  const [animation, setAnimation] = useState('step')
  const [themePreset, setThemePreset] = useState('indigo')
  const [font, setFont] = useState('Geist')

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`bb_theme_${botId}`)
    if (saved) {
      try {
        const t = JSON.parse(saved) as { animation?: string; themePreset?: string; font?: string }
        if (t.animation) setAnimation(t.animation)
        if (t.themePreset) setThemePreset(t.themePreset)
        if (t.font) setFont(t.font)
      } catch { /* ignore */ }
    }
  }, [botId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/config/${botId}/templates?language=${tab}`)
      const data = await res.json() as { templates?: ResponseTemplate[]; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to load'); return }
      setTemplates(data.templates ?? [])
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [botId, tab])

  useEffect(() => { load() }, [load])

  function getTemplate(intentKey: string) {
    return templates.find((t) => t.intent === intentKey && t.language === tab)
  }

  async function handleSaveTemplate(intentKey: string, content: string, format: string) {
    setSaving(intentKey)
    try {
      const res = await fetch(`/api/config/${botId}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: intentKey, language: tab, content, format }),
      })
      const data = await res.json() as { template?: ResponseTemplate; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }
      // Update local state
      setTemplates((prev) => {
        const idx = prev.findIndex((t) => t.intent === intentKey && t.language === tab)
        if (idx >= 0 && data.template) {
          const next = [...prev]
          next[idx] = data.template
          return next
        }
        return data.template ? [...prev, data.template] : prev
      })
      toast.success(`${intentKey} template saved`)
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(null)
    }
  }

  function handleSaveTheme() {
    localStorage.setItem(`bb_theme_${botId}`, JSON.stringify({ animation, themePreset, font }))
    toast.success('Theme preferences saved locally')
  }

  const selectStyle = {
    background: 'var(--bb-surface-2)',
    borderColor: 'var(--bb-border)',
    color: 'var(--bb-text-1)',
  }

  return (
    <div className="max-w-3xl space-y-6 pb-10">

      {/* Response Templates */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <SectionHeader>Auto-Format Rules</SectionHeader>
            <p className="text-xs -mt-3" style={{ color: 'var(--bb-text-3)' }}>
              Override the default AI format for each intent. Leave blank to let AI decide.
            </p>
          </div>

          {/* Language tabs */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bb-surface-2)' }}>
            {LANG_TABS.map(({ key, label }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--bb-surface)' : 'transparent',
                    color: active ? 'var(--bb-text-1)' : 'var(--bb-text-3)',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12" style={{ color: 'var(--bb-text-3)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {INTENTS.map((intent) => (
              <TemplateRow
                key={`${intent.key}-${tab}`}
                intent={intent}
                template={getTemplate(intent.key)}
                saving={saving}
                onSave={handleSaveTemplate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Processing Animation */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Processing Animation</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          {ANIMATION_OPTIONS.map((opt) => {
            const active = animation === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnimation(opt.value)}
                className="rounded-xl border p-4 text-left transition-all"
                style={{
                  background: active ? 'rgba(99,102,241,0.08)' : 'var(--bb-surface-2)',
                  borderColor: active ? 'var(--bb-primary)' : 'var(--bb-border)',
                  borderWidth: active ? '2px' : '1px',
                }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: active ? 'var(--bb-primary)' : 'var(--bb-text-1)' }}>
                  {opt.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>{opt.desc}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Chat UI Theme */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Chat UI Theme</SectionHeader>

        {/* Colour presets */}
        <p className="text-xs mb-3" style={{ color: 'var(--bb-text-3)' }}>Colour Palette</p>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {THEME_PRESETS.map((preset) => {
            const active = themePreset === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setThemePreset(preset.id)}
                className="rounded-xl border p-3 text-left transition-all"
                style={{
                  background: active ? 'rgba(99,102,241,0.08)' : 'var(--bb-surface-2)',
                  borderColor: active ? 'var(--bb-primary)' : 'var(--bb-border)',
                  borderWidth: active ? '2px' : '1px',
                }}
              >
                <div className="flex gap-1.5 mb-2">
                  <span className="w-4 h-4 rounded-full" style={{ background: preset.primary }} />
                  <span className="w-4 h-4 rounded-full" style={{ background: preset.secondary }} />
                </div>
                <p className="text-xs font-medium" style={{ color: active ? 'var(--bb-primary)' : 'var(--bb-text-2)' }}>
                  {preset.label}
                </p>
              </button>
            )
          })}
        </div>

        {/* Font selector */}
        <div className="mb-5">
          <p className="text-xs mb-2" style={{ color: 'var(--bb-text-3)' }}>Font Family</p>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="w-full max-w-xs px-3 py-2.5 rounded-lg text-sm border outline-none appearance-none"
            style={selectStyle}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--bb-border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
            Theme applied to widget when Widget module is enabled
          </p>
          <button
            type="button"
            onClick={handleSaveTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            <Save className="w-3.5 h-3.5" />
            Save Theme
          </button>
        </div>
      </section>
    </div>
  )
}
