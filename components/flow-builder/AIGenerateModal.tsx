'use client'

import { useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import type { FlowData } from '@/types/database'

const INDUSTRIES = ['Healthcare', 'Insurance', 'Property', 'F&B', 'E-commerce', 'Education', 'Finance', 'Retail', 'Other']

interface AIGenerateModalProps {
  botId: string
  onClose: () => void
  onGenerated: (data: FlowData) => void
}

export function AIGenerateModal({ botId, onClose, onGenerated }: AIGenerateModalProps) {
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('Healthcare')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scripts/${botId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, industry }),
      })
      const data = await res.json() as { flow_data?: FlowData; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      if (!data.flow_data) throw new Error('No flow data returned')
      onGenerated(data.flow_data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-lg rounded-xl border"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--bb-primary)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--bb-text-1)' }}>Generate Flow with AI</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--bb-text-3)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
              Describe your conversation flow
            </label>
            <textarea
              className="w-full text-sm rounded-lg px-3 py-2.5 resize-none"
              rows={6}
              placeholder="e.g. Greet the patient, ask which service they need, collect name and phone, then book an appointment. If they ask something else, use the AI to answer from knowledge base."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
              Industry
            </label>
            <select
              className="w-full text-sm rounded-lg px-3 py-2"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
                outline: 'none',
              }}
            >
              {INDUSTRIES.map((ind) => <option key={ind}>{ind}</option>)}
            </select>
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--bb-border)' }}
        >
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
          >
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={loading || !description.trim()}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Generating…' : 'Generate Flow'}
          </button>
        </div>
      </div>
    </div>
  )
}
