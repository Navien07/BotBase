'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles, Edit2, Trash2, ToggleLeft, ToggleRight, Copy, Zap, Clock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { AIGenerateModal } from '@/components/flow-builder/AIGenerateModal'
import type { BotScript, FlowData } from '@/types/database'

const TRIGGER_LABELS: Record<string, { label: string; color: string }> = {
  always:  { label: 'Always', color: '#6366f1' },
  intent:  { label: 'Intent', color: '#3b82f6' },
  keyword: { label: 'Keyword', color: '#eab308' },
  manual:  { label: 'Manual', color: '#6b7280' },
  api:     { label: 'API', color: '#22c55e' },
}

interface ScriptsPageProps {
  params: Promise<{ botId: string }>
}

export default function ScriptsPage({ params }: ScriptsPageProps) {
  const { botId } = use(params)
  const router = useRouter()
  const [scripts, setScripts] = useState<BotScript[]>([])
  const [loading, setLoading] = useState(true)
  const [showAI, setShowAI] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchScripts()
  }, [botId])

  async function fetchScripts() {
    try {
      const res = await fetch(`/api/scripts/${botId}`)
      const data = await res.json() as { scripts?: BotScript[] }
      setScripts(data.scripts ?? [])
    } catch {
      toast.error('Failed to load scripts')
    } finally {
      setLoading(false)
    }
  }

  async function createBlank() {
    setCreating(true)
    try {
      const res = await fetch(`/api/scripts/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Script' }),
      })
      const data = await res.json() as { script?: BotScript }
      if (!res.ok) throw new Error()
      router.push(`/dashboard/bots/${botId}/scripts/${data.script!.id}`)
    } catch {
      toast.error('Failed to create script')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(script: BotScript) {
    try {
      const res = await fetch(`/api/scripts/${botId}/${script.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !script.is_active }),
      })
      if (!res.ok) throw new Error()
      setScripts((prev) => prev.map((s) => s.id === script.id ? { ...s, is_active: !s.is_active } : s))
      toast.success(script.is_active ? 'Script deactivated' : 'Script activated')
    } catch {
      toast.error('Failed to update script')
    }
  }

  async function duplicate(script: BotScript) {
    try {
      const res = await fetch(`/api/scripts/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${script.name} (copy)`,
          trigger_type: script.trigger_type,
          trigger_value: script.trigger_value,
          flow_data: script.flow_data,
        }),
      })
      const data = await res.json() as { script?: BotScript }
      if (!res.ok) throw new Error()
      setScripts((prev) => [...prev, data.script!])
      toast.success('Script duplicated')
    } catch {
      toast.error('Failed to duplicate script')
    }
  }

  async function deleteScript(script: BotScript) {
    if (!confirm(`Delete "${script.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/scripts/${botId}/${script.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setScripts((prev) => prev.filter((s) => s.id !== script.id))
      toast.success('Script deleted')
    } catch {
      toast.error('Failed to delete script')
    }
  }

  async function onAIGenerated(flowData: FlowData) {
    try {
      const res = await fetch(`/api/scripts/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'AI Generated Script', flow_data: flowData }),
      })
      const data = await res.json() as { script?: BotScript }
      if (!res.ok) throw new Error()
      router.push(`/dashboard/bots/${botId}/scripts/${data.script!.id}`)
    } catch {
      toast.error('Failed to save generated script')
    }
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>Flow Scripts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            Visual conversation flows that trigger based on intent or keyword
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border"
            style={{ borderColor: 'var(--bb-primary)', color: 'var(--bb-primary)', background: 'var(--bb-primary-subtle)' }}
          >
            <Sparkles size={14} /> Generate with AI
          </button>
          <button
            onClick={createBlank}
            disabled={creating}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            <Plus size={14} /> New Script
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--bb-border)', background: 'var(--bb-surface)' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading…</div>
        ) : scripts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Zap size={32} className="mx-auto" style={{ color: 'var(--bb-text-3)' }} />
            <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>No scripts yet. Create one or generate with AI.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bb-border)' }}>
                {['Script', 'Trigger', 'Status', 'Version', 'Published', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium px-4 py-3" style={{ color: 'var(--bb-text-3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scripts.map((script) => {
                const trig = TRIGGER_LABELS[script.trigger_type] ?? { label: script.trigger_type, color: '#6b7280' }
                return (
                  <tr
                    key={script.id}
                    style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>{script.name}</div>
                      {script.description && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>{script.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full w-fit font-medium"
                          style={{ background: trig.color + '20', color: trig.color }}
                        >
                          {trig.label}
                        </span>
                        {script.trigger_value && (
                          <span className="text-xs" style={{ color: 'var(--bb-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {script.trigger_value}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {script.is_active ? (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--bb-success)' }}>
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                          <Clock size={12} /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                      v{script.version}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--bb-text-3)' }}>
                      {script.published_at ? format(new Date(script.published_at), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/dashboard/bots/${botId}/scripts/${script.id}`)}
                          className="p-1.5 rounded"
                          style={{ color: 'var(--bb-text-3)' }}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(script)}
                          className="p-1.5 rounded"
                          style={{ color: script.is_active ? 'var(--bb-success)' : 'var(--bb-text-3)' }}
                          title={script.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {script.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                        <button
                          onClick={() => duplicate(script)}
                          className="p-1.5 rounded"
                          style={{ color: 'var(--bb-text-3)' }}
                          title="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => deleteScript(script)}
                          className="p-1.5 rounded"
                          style={{ color: 'var(--bb-danger)' }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAI && (
        <AIGenerateModal
          botId={botId}
          onClose={() => setShowAI(false)}
          onGenerated={onAIGenerated}
        />
      )}
    </div>
  )
}
