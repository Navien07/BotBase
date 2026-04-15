'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import { ArrowLeft, Save, Send, Sparkles, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FlowCanvas } from '@/components/flow-builder/FlowCanvas'
import { NodePanel } from '@/components/flow-builder/NodePanel'
import { FlowPreview } from '@/components/flow-builder/FlowPreview'
import { AIGenerateModal } from '@/components/flow-builder/AIGenerateModal'
import type { BotScript, FlowData } from '@/types/database'

const TRIGGER_TYPES = [
  { value: 'keyword', label: 'Keyword' },
  { value: 'intent', label: 'Intent' },
  { value: 'always', label: 'Always' },
  { value: 'manual', label: 'Manual' },
  { value: 'api', label: 'API' },
]

const EMPTY_FLOW: FlowData = { nodes: [], edges: [] }

interface ScriptEditorPageProps {
  params: Promise<{ botId: string; id: string }>
}

export default function ScriptEditorPage({ params }: ScriptEditorPageProps) {
  const { botId, id } = use(params)
  const router = useRouter()
  const [script, setScript] = useState<BotScript | null>(null)
  const [flowData, setFlowData] = useState<FlowData>(EMPTY_FLOW)
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState('keyword')
  const [triggerValue, setTriggerValue] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)
  const [showAI, setShowAI] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [dirty, setDirty] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/scripts/${botId}/${id}`)
        const data = await res.json() as { script?: BotScript }
        if (!res.ok || !data.script) { router.push(`/dashboard/bots/${botId}/scripts`); return }
        setScript(data.script)
        setName(data.script.name)
        setTriggerType(data.script.trigger_type)
        setTriggerValue(data.script.trigger_value ?? '')
        setFlowData(data.script.flow_data ?? EMPTY_FLOW)
      } catch {
        toast.error('Failed to load script')
      }
    }
    load()
  }, [botId, id, router])

  const autoSave = useCallback(async (fd: FlowData, n: string, tt: string, tv: string) => {
    try {
      await fetch(`/api/scripts/${botId}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, trigger_type: tt, trigger_value: tv || null, flow_data: fd }),
      })
      setDirty(false)
    } catch {
      // silent fail on auto-save
    }
  }, [botId, id])

  function onFlowChange(fd: FlowData) {
    setFlowData(fd)
    setDirty(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => autoSave(fd, name, triggerType, triggerValue), 2000)
  }

  async function saveDraft() {
    setSaving(true)
    try {
      const res = await fetch(`/api/scripts/${botId}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, trigger_type: triggerType, trigger_value: triggerValue || null, flow_data: flowData }),
      })
      if (!res.ok) throw new Error()
      setDirty(false)
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    setPublishing(true)
    try {
      // Save current state first
      await fetch(`/api/scripts/${botId}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, trigger_type: triggerType, trigger_value: triggerValue || null, flow_data: flowData }),
      })
      // Then publish
      const res = await fetch(`/api/scripts/${botId}/${id}/publish`, { method: 'POST' })
      const data = await res.json() as { script?: BotScript }
      if (!res.ok) throw new Error()
      setScript(data.script ?? script)
      setDirty(false)
      toast.success('Script published and active')
    } catch {
      toast.error('Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  function loadTemplate(data: FlowData) {
    if (flowData.nodes.length > 0 && !confirm('Replace current flow with template?')) return
    setFlowData(data)
    setCanvasKey((k) => k + 1)
    setDirty(true)
  }

  function onAIGenerated(data: FlowData) {
    setFlowData(data)
    setCanvasKey((k) => k + 1)
    setDirty(true)
    toast.success('Flow generated — auto-saving as draft')
    setTimeout(() => autoSave(data, name, triggerType, triggerValue), 500)
  }

  if (!script) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--bb-text-3)' }} />
      </div>
    )
  }

  const inputStyle = {
    background: 'var(--bb-surface-2)',
    border: '1px solid var(--bb-border)',
    color: 'var(--bb-text-1)',
    outline: 'none',
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Toolbar */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
          style={{ background: 'var(--bb-surface)', borderBottom: '1px solid var(--bb-border)' }}
        >
          <button
            onClick={() => router.push(`/dashboard/bots/${botId}/scripts`)}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--bb-text-3)' }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--bb-border)' }} />

          {/* Name editor */}
          <input
            className="text-sm font-medium px-2 py-1 rounded"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true) }}
            onBlur={() => dirty && autoSave(flowData, name, triggerType, triggerValue)}
            style={inputStyle}
          />

          <div style={{ width: 1, height: 20, background: 'var(--bb-border)' }} />

          {/* Trigger config */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Trigger:</span>
            <select
              className="text-xs rounded px-2 py-1"
              value={triggerType}
              onChange={(e) => { setTriggerType(e.target.value); setDirty(true) }}
              style={inputStyle}
            >
              {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {['keyword', 'intent'].includes(triggerType) && (
              <input
                className="text-xs rounded px-2 py-1"
                placeholder={triggerType === 'keyword' ? 'book, appointment…' : 'book_session'}
                value={triggerValue}
                onChange={(e) => { setTriggerValue(e.target.value); setDirty(true) }}
                style={{ ...inputStyle, width: 140 }}
              />
            )}
          </div>

          <div className="flex-1" />

          {dirty && (
            <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Unsaved changes</span>
          )}

          <button
            onClick={saveDraft}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Draft
          </button>

          <button
            onClick={publish}
            disabled={publishing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bb-success)', color: '#fff' }}
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Publish
          </button>

          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            <Sparkles size={12} /> Generate
          </button>
        </div>

        {/* Three-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Node panel */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <NodePanel onLoadTemplate={loadTemplate} />
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 min-w-0">
            <FlowCanvas
              key={canvasKey}
              initialData={flowData}
              onChange={onFlowChange}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
            />
          </div>

          {/* Right: Preview */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <FlowPreview
              flowData={flowData}
              onNodeSelect={setSelectedNodeId}
            />
          </div>
        </div>
      </div>

      {showAI && (
        <AIGenerateModal
          botId={botId}
          onClose={() => setShowAI(false)}
          onGenerated={onAIGenerated}
        />
      )}
    </ReactFlowProvider>
  )
}
