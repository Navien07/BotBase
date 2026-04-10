'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FAQ {
  id: string
  question: string
  answer: string
  language: 'en' | 'bm' | 'zh'
  is_active: boolean
  created_at: string
  updated_at: string
}

type LangTab = 'all' | 'en' | 'bm' | 'zh'

// ─── Constants ─────────────────────────────────────────────────────────────────

const LANG_TABS: { key: LangTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'en', label: 'EN' },
  { key: 'bm', label: 'BM' },
  { key: 'zh', label: 'ZH' },
]

const LANG_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  en: { bg: 'rgba(99,102,241,0.12)', color: 'var(--bb-primary)', label: 'EN' },
  bm: { bg: 'rgba(34,211,238,0.12)', color: 'var(--bb-accent)', label: 'BM' },
  zh: { bg: 'rgba(245,158,11,0.12)', color: 'var(--bb-warning)', label: 'ZH' },
}

const EMPTY_FORM = { question: '', answer: '', language: 'en' as const }

// ─── Sub-components ────────────────────────────────────────────────────────────

function LanguageBadge({ lang }: { lang: string }) {
  const style = LANG_BADGE[lang]
  if (!style) return null
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
      {children}{required && <span style={{ color: 'var(--bb-danger)' }}> *</span>}
    </label>
  )
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="rounded-xl border p-6 w-full max-w-sm mx-4"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--bb-text-1)' }}>Delete FAQ</h3>
        <p className="text-sm mb-5" style={{ color: 'var(--bb-text-3)' }}>
          This will permanently delete the FAQ. This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)', background: 'var(--bb-surface-2)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--bb-danger)', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FAQ form sheet ────────────────────────────────────────────────────────────

interface SheetProps {
  initial?: FAQ | null
  saving: boolean
  onSave: (data: { question: string; answer: string; language: 'en' | 'bm' | 'zh' }) => void
  onClose: () => void
}

function FaqSheet({ initial, saving, onSave, onClose }: SheetProps) {
  const [form, setForm] = useState({
    question: initial?.question ?? '',
    answer: initial?.answer ?? '',
    language: (initial?.language ?? 'en') as 'en' | 'bm' | 'zh',
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  const inputStyle = {
    background: 'var(--bb-surface-2)',
    borderColor: 'var(--bb-border)',
    color: 'var(--bb-text-1)',
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-md h-full overflow-y-auto flex flex-col"
        style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--bb-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            {initial ? 'Edit FAQ' : 'Add FAQ'}
          </h2>
          <button type="button" onClick={onClose} style={{ color: 'var(--bb-text-3)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-5">
          <div>
            <FieldLabel required>Language</FieldLabel>
            <div className="flex gap-2">
              {(['en', 'bm', 'zh'] as const).map((lang) => {
                const active = form.language === lang
                const badge = LANG_BADGE[lang]
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => set('language', lang)}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      background: active ? badge.bg : 'var(--bb-surface-2)',
                      borderColor: active ? badge.color : 'var(--bb-border)',
                      color: active ? badge.color : 'var(--bb-text-3)',
                    }}
                  >
                    {badge.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <FieldLabel required>Question</FieldLabel>
            <textarea
              value={form.question}
              onChange={(e) => set('question', e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. What are your operating hours?"
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 resize-none"
              style={inputStyle}
            />
          </div>

          <div>
            <FieldLabel required>Answer</FieldLabel>
            <textarea
              value={form.answer}
              onChange={(e) => set('answer', e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="Enter the answer..."
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 resize-y"
              style={inputStyle}
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--bb-text-3)' }}>
              {form.answer.length} / 2000
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--bb-border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)', background: 'var(--bb-surface-2)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saving || !form.question.trim() || !form.answer.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save FAQ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function FaqsPage() {
  const params = useParams()
  const botId = params.botId as string

  const [tab, setTab] = useState<LangTab>('all')
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showSheet, setShowSheet] = useState(false)
  const [editFaq, setEditFaq] = useState<FAQ | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = tab === 'all'
        ? `/api/faqs/${botId}`
        : `/api/faqs/${botId}?language=${tab}`
      const res = await fetch(url)
      const data = await res.json() as { faqs?: FAQ[]; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to load'); return }
      setFaqs(data.faqs ?? [])
    } catch {
      toast.error('Failed to load FAQs')
    } finally {
      setLoading(false)
    }
  }, [botId, tab])

  useEffect(() => { load() }, [load])

  async function handleSave(form: { question: string; answer: string; language: 'en' | 'bm' | 'zh' }) {
    setSaving(true)
    try {
      if (editFaq) {
        const res = await fetch(`/api/faqs/${botId}/${editFaq.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json() as { faq?: FAQ; error?: string }
        if (!res.ok) { toast.error(data.error ?? 'Update failed'); return }
        toast.success('FAQ updated')
      } else {
        const res = await fetch(`/api/faqs/${botId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json() as { faq?: FAQ; error?: string }
        if (!res.ok) { toast.error(data.error ?? 'Create failed'); return }
        toast.success('FAQ added')
      }
      setShowSheet(false)
      setEditFaq(null)
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/faqs/${botId}/${id}`, { method: 'DELETE' })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Delete failed'); return }
      toast.success('FAQ deleted')
      setDeleteId(null)
      await load()
    } catch {
      toast.error('Network error')
    }
  }

  function openEdit(faq: FAQ) {
    setEditFaq(faq)
    setShowSheet(true)
  }

  function closeSheet() {
    setShowSheet(false)
    setEditFaq(null)
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>FAQs</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            {faqs.length} FAQ{faqs.length !== 1 ? 's' : ''} · Embedded for semantic search
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditFaq(null); setShowSheet(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          <Plus className="w-4 h-4" />
          Add FAQ
        </button>
      </div>

      {/* Language tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: 'var(--bb-surface-2)' }}>
        {LANG_TABS.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
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

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
        {/* Table header */}
        <div
          className="grid px-5 py-3 text-xs font-medium uppercase tracking-wider"
          style={{
            gridTemplateColumns: '1fr 1fr 80px 72px',
            color: 'var(--bb-text-3)',
            borderBottom: '1px solid var(--bb-border)',
            background: 'var(--bb-surface-2)',
          }}
        >
          <span>Question</span>
          <span>Answer</span>
          <span>Language</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: 'var(--bb-text-3)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : faqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>No FAQs yet</p>
            <button
              type="button"
              onClick={() => { setEditFaq(null); setShowSheet(true) }}
              className="mt-3 text-xs hover:opacity-80 transition-opacity"
              style={{ color: 'var(--bb-primary)' }}
            >
              + Add your first FAQ
            </button>
          </div>
        ) : (
          faqs.map((faq, idx) => (
            <div
              key={faq.id}
              className="grid px-5 py-3.5 items-center"
              style={{
                gridTemplateColumns: '1fr 1fr 80px 72px',
                borderBottom: idx < faqs.length - 1 ? '1px solid var(--bb-border-subtle)' : 'none',
              }}
            >
              <p className="text-sm pr-4 truncate" style={{ color: 'var(--bb-text-1)' }} title={faq.question}>
                {faq.question}
              </p>
              <p className="text-xs pr-4 truncate" style={{ color: 'var(--bb-text-3)' }} title={faq.answer}>
                {faq.answer}
              </p>
              <div>
                <LanguageBadge lang={faq.language} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(faq)}
                  className="hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--bb-text-3)' }}
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(faq.id)}
                  className="hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--bb-danger)' }}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAQ Sheet */}
      {showSheet && (
        <FaqSheet
          initial={editFaq}
          saving={saving}
          onSave={handleSave}
          onClose={closeSheet}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <DeleteModal
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
