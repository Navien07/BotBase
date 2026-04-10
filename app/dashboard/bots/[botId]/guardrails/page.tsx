'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, X, Trash2 } from 'lucide-react'
import type { GuardrailRules } from '@/types/database'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GuardrailsData {
  guardrail_rules: GuardrailRules
  keyword_blocklist: string[]
  fact_grounding: boolean
  hallucination_guard: boolean
  response_min_words: number
  response_max_words: number
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--bb-text-2)' }}>
      {children}
    </p>
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
        className="relative rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? 'var(--bb-primary)' : 'var(--bb-surface-3)', width: '40px', height: '22px' }}
      >
        <span
          className="absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform"
          style={{ width: '18px', height: '18px', transform: value ? 'translateX(18px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}

// ─── Rule list section ─────────────────────────────────────────────────────────

function RuleList({ rules, onChange }: { rules: string[]; onChange: (rules: string[]) => void }) {
  const [newRule, setNewRule] = useState('')

  function addRule() {
    const trimmed = newRule.trim()
    if (!trimmed) return
    onChange([...rules, trimmed])
    setNewRule('')
  }

  function removeRule(idx: number) {
    onChange(rules.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      {rules.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)' }}>
          <span className="flex-1 text-sm" style={{ color: 'var(--bb-text-1)' }}>{rule}</span>
          <button type="button" onClick={() => removeRule(idx)}
            className="hover:opacity-80 transition-opacity"
            style={{ color: 'var(--bb-text-3)' }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          type="text"
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRule() } }}
          placeholder="Type a rule and press Enter..."
          className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
          style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
        />
        <button type="button" onClick={addRule}
          className="px-3 py-2 rounded-lg text-sm border flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)', background: 'var(--bb-surface-3)' }}>
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  )
}

// ─── Keyword blocklist ─────────────────────────────────────────────────────────

function KeywordBlocklist({ keywords, onChange }: { keywords: string[]; onChange: (kw: string[]) => void }) {
  const [input, setInput] = useState('')

  function addKeyword() {
    const trimmed = input.trim().toLowerCase()
    if (!trimmed || keywords.includes(trimmed)) return
    onChange([...keywords, trimmed])
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-8">
        {keywords.map((kw) => (
          <span key={kw}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--bb-danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {kw}
            <button type="button" onClick={() => onChange(keywords.filter((k) => k !== kw))}
              className="hover:opacity-80 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>No blocked keywords</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
          placeholder="Type a word and press Enter..."
          className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
          style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
        />
        <button type="button" onClick={addKeyword}
          className="px-3 py-2 rounded-lg text-sm border flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)', background: 'var(--bb-surface-3)' }}>
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  )
}

// ─── Slider ────────────────────────────────────────────────────────────────────

function LabeledSlider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm" style={{ color: 'var(--bb-text-1)' }}>{label}</label>
        <span className="text-sm font-medium tabular-nums px-2 py-0.5 rounded"
          style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-primary)' }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: 'var(--bb-primary)', background: 'var(--bb-surface-3)' }}
      />
      <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--bb-text-3)' }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GuardrailsPage() {
  const params = useParams()
  const botId = params.botId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<GuardrailsData>({
    guardrail_rules: { in_scope: [], out_of_scope: [], important: [] },
    keyword_blocklist: [],
    fact_grounding: true,
    hallucination_guard: true,
    response_min_words: 20,
    response_max_words: 300,
  })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/config/${botId}/guardrails`)
      const data = await res.json() as { guardrails?: GuardrailsData; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to load'); return }
      if (data.guardrails) setForm(data.guardrails)
    } catch {
      toast.error('Failed to load guardrail settings')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { load() }, [load])

  function setField<K extends keyof GuardrailsData>(key: K, value: GuardrailsData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setRules(section: keyof GuardrailRules, rules: string[]) {
    setForm((prev) => ({
      ...prev,
      guardrail_rules: { ...prev.guardrail_rules, [section]: rules },
    }))
  }

  async function handleSave() {
    if (form.response_min_words >= form.response_max_words) {
      toast.error('Minimum words must be less than maximum words')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/guardrails`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return }
      toast.success('Guardrail settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
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
      {/* In Scope */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>In Scope</SectionHeader>
        <p className="text-xs mb-4" style={{ color: 'var(--bb-text-3)' }}>
          Topics the bot is allowed and expected to answer.
        </p>
        <RuleList
          rules={form.guardrail_rules.in_scope}
          onChange={(rules) => setRules('in_scope', rules)}
        />
      </section>

      {/* Out of Scope */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Out of Scope</SectionHeader>
        <p className="text-xs mb-4" style={{ color: 'var(--bb-text-3)' }}>
          Topics the bot should decline to answer.
        </p>
        <RuleList
          rules={form.guardrail_rules.out_of_scope}
          onChange={(rules) => setRules('out_of_scope', rules)}
        />
      </section>

      {/* Important Rules */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Important Rules</SectionHeader>
        <p className="text-xs mb-4" style={{ color: 'var(--bb-text-3)' }}>
          Mandatory instructions always included in every response.
        </p>
        <RuleList
          rules={form.guardrail_rules.important}
          onChange={(rules) => setRules('important', rules)}
        />
      </section>

      {/* Content Moderation */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Content Moderation</SectionHeader>
        <ToggleRow
          label="Fact Grounding"
          description="Only answer based on provided knowledge — decline when unsure"
          value={form.fact_grounding}
          onChange={(v) => setField('fact_grounding', v)}
        />
        <ToggleRow
          label="Hallucination Guard"
          description="Add disclaimer when answering outside the knowledge base"
          value={form.hallucination_guard}
          onChange={(v) => setField('hallucination_guard', v)}
        />
      </section>

      {/* Response Length */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Response Length</SectionHeader>
        <div className="space-y-6">
          <LabeledSlider
            label="Minimum words per response"
            value={form.response_min_words}
            min={0}
            max={100}
            onChange={(v) => setField('response_min_words', v)}
          />
          <LabeledSlider
            label="Maximum words per response"
            value={form.response_max_words}
            min={50}
            max={500}
            onChange={(v) => setField('response_max_words', v)}
          />
        </div>
      </section>

      {/* Keyword Blocklist */}
      <section className="rounded-xl border p-6" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        <SectionHeader>Keyword Blocklist</SectionHeader>
        <p className="text-xs mb-4" style={{ color: 'var(--bb-text-3)' }}>
          Messages containing these words will be blocked automatically.
        </p>
        <KeywordBlocklist
          keywords={form.keyword_blocklist}
          onChange={(kw) => setField('keyword_blocklist', kw)}
        />
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
