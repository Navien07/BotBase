'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Sparkles, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PersonalityData {
  bot_name: string
  system_prompt: string | null
  personality_preset: string
  tone_formal: boolean
  tone_verbose: boolean
  tone_emoji: boolean
  tone_lock_language: boolean
  greeting_en: string | null
  greeting_bm: string | null
  greeting_zh: string | null
  default_language: string
  timezone: string
  avatar_url: string | null
}

// ─── Preset templates ──────────────────────────────────────────────────────────

const PRESET_PROMPTS: Record<string, string> = {
  professional:
    'You are a professional AI assistant. Respond clearly and concisely with accurate information. Maintain a formal tone, avoid slang, and always provide complete, well-structured answers.',
  friendly:
    'You are a friendly and helpful AI assistant. Engage warmly with users, use a conversational tone, and make interactions enjoyable while remaining helpful and informative.',
  concise:
    'You are a concise AI assistant. Provide brief, direct answers. Avoid unnecessary elaboration. Get to the point immediately.',
  custom: '',
}

const PRESETS = [
  { id: 'professional', label: 'Professional', desc: 'Formal, structured responses' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm, conversational tone' },
  { id: 'concise', label: 'Concise', desc: 'Brief, direct answers' },
  { id: 'custom', label: 'Custom', desc: 'Write your own prompt' },
]

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

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1"
      style={{
        background: 'var(--bb-surface-2)',
        borderColor: 'var(--bb-border)',
        color: 'var(--bb-text-1)',
      }}
    />
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--bb-border-subtle)' }}>
      <div>
        <p className="text-sm" style={{ color: 'var(--bb-text-1)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0"
        style={{
          background: value ? 'var(--bb-primary)' : 'var(--bb-surface-3)',
          width: '40px',
          height: '22px',
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform"
          style={{
            width: '18px',
            height: '18px',
            transform: value ? 'translateX(18px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PersonalityPage() {
  const params = useParams()
  const botId = params.botId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [form, setForm] = useState<PersonalityData>({
    bot_name: '',
    system_prompt: null,
    personality_preset: 'friendly',
    tone_formal: false,
    tone_verbose: false,
    tone_emoji: true,
    tone_lock_language: false,
    greeting_en: null,
    greeting_bm: null,
    greeting_zh: null,
    default_language: 'en',
    timezone: 'Asia/Kuala_Lumpur',
    avatar_url: null,
  })

  const [botDescription, setBotDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/config/${botId}/personality`)
      const data = await res.json() as { personality?: PersonalityData; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to load'); return }
      if (data.personality) setForm(data.personality)
    } catch {
      toast.error('Failed to load personality settings')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { load() }, [load])

  function setField<K extends keyof PersonalityData>(key: K, value: PersonalityData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePresetSelect(presetId: string) {
    setField('personality_preset', presetId)
    if (presetId !== 'custom') {
      setField('system_prompt', PRESET_PROMPTS[presetId] ?? '')
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return }

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `avatars/${botId}.${ext}`
      const { error } = await supabase.storage
        .from('bot-files')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (error) throw error

      const { data: urlData } = supabase.storage.from('bot-files').getPublicUrl(path)
      setField('avatar_url', urlData.publicUrl)
      toast.success('Avatar uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleGenerate() {
    if (!botDescription || !industry) {
      toast.error('Enter a bot description and industry first')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(`/api/config/${botId}/personality/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botDescription, industry }),
      })
      const data = await res.json() as { systemPrompt?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }
      setField('system_prompt', data.systemPrompt ?? '')
      setField('personality_preset', 'custom')
    } catch {
      toast.error('Network error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/personality`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }
      toast.success('Personality settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const charCount = (form.system_prompt ?? '').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: 'var(--bb-text-3)' }}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      {/* Identity */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Identity</SectionHeader>
        <div className="flex items-start gap-5 mb-5">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold overflow-hidden cursor-pointer relative"
              style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {form.avatar_url
                ? <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                : <span style={{ color: 'var(--bb-primary)' }}>{form.bot_name.charAt(0) || 'B'}</span>
              }
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 flex items-center gap-1 text-xs hover:opacity-80 transition-opacity"
              style={{ color: 'var(--bb-text-3)' }}
            >
              <Upload className="w-3 h-3" /> Upload
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Display name */}
          <div className="flex-1">
            <FieldLabel required>Display Name</FieldLabel>
            <TextInput value={form.bot_name} onChange={(v) => setField('bot_name', v)} placeholder="e.g. Ethan" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Default Language</FieldLabel>
            <select
              value={form.default_language}
              onChange={(e) => setField('default_language', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 appearance-none"
              style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
            >
              <option value="en">English</option>
              <option value="bm">Bahasa Malaysia</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <div>
            <FieldLabel>Timezone</FieldLabel>
            <select
              value={form.timezone}
              onChange={(e) => setField('timezone', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 appearance-none"
              style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Personality Preset */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Personality Preset</SectionHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((preset) => {
            const active = form.personality_preset === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset.id)}
                className="rounded-xl border p-4 text-left transition-all"
                style={{
                  background: active ? 'rgba(99,102,241,0.08)' : 'var(--bb-surface-2)',
                  borderColor: active ? 'var(--bb-primary)' : 'var(--bb-border)',
                  borderWidth: active ? '2px' : '1px',
                }}
              >
                <p className="text-sm font-medium" style={{ color: active ? 'var(--bb-primary)' : 'var(--bb-text-1)' }}>
                  {preset.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>{preset.desc}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* System Prompt */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>System Prompt</SectionHeader>

        {/* Generate inputs */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <FieldLabel>Bot Description</FieldLabel>
            <TextInput
              value={botDescription}
              onChange={setBotDescription}
              placeholder="e.g. A wellness booking assistant for GenQi centres"
            />
          </div>
          <div>
            <FieldLabel>Industry</FieldLabel>
            <TextInput value={industry} onChange={setIndustry} placeholder="e.g. Health & Wellness" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border mb-4 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: 'var(--bb-primary)', color: 'var(--bb-primary)', background: 'rgba(99,102,241,0.08)' }}
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Generating...' : '✨ Generate'}
        </button>

        <textarea
          value={form.system_prompt ?? ''}
          onChange={(e) => setField('system_prompt', e.target.value)}
          rows={8}
          maxLength={8000}
          placeholder="Enter your system prompt..."
          className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 resize-y font-mono"
          style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
        />
        <p className="text-xs mt-1.5 text-right" style={{ color: charCount > 7000 ? 'var(--bb-warning)' : 'var(--bb-text-3)' }}>
          {charCount} / 8000
        </p>
      </section>

      {/* Tone Settings */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Tone Settings</SectionHeader>
        <ToggleRow label="Formal Tone" description="Use formal language and avoid contractions" value={form.tone_formal} onChange={(v) => setField('tone_formal', v)} />
        <ToggleRow label="Verbose Responses" description="Provide detailed, comprehensive answers" value={form.tone_verbose} onChange={(v) => setField('tone_verbose', v)} />
        <ToggleRow label="Use Emoji" description="Add relevant emoji to responses" value={form.tone_emoji} onChange={(v) => setField('tone_emoji', v)} />
        <ToggleRow label="Lock Response Language" description="Always reply in the bot's default language" value={form.tone_lock_language} onChange={(v) => setField('tone_lock_language', v)} />
      </section>

      {/* Welcome Messages */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Welcome Messages</SectionHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { key: 'greeting_en' as const, label: 'English', placeholder: 'Hi! How can I help you today?' },
            { key: 'greeting_bm' as const, label: 'Bahasa Malaysia', placeholder: 'Hai! Boleh saya bantu?' },
            { key: 'greeting_zh' as const, label: '中文', placeholder: '您好！请问有什么可以帮助您？' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <FieldLabel>{label}</FieldLabel>
              <textarea
                value={form[key] ?? ''}
                onChange={(e) => setField(key, e.target.value || null)}
                placeholder={placeholder}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 resize-none"
                style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
