'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineStepData {
  step: number
  name: string
  status: 'pass' | 'block' | 'skip' | 'error'
  durationMs: number
  data: Record<string, unknown>
  blockedResponse?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_ICONS: Record<number, string> = {
  1: '🕐', 2: '🛡️', 3: '🔍', 4: '🔀',
  5: '❓', 6: '📚', 7: '🌐', 8: '📅',
  9: '📝', 10: '🤖',
}

const STATUS_CLASSES: Record<string, { badge: string; dot: string }> = {
  pass:  { badge: 'bg-green-500/10 text-green-400', dot: '#22c55e' },
  block: { badge: 'bg-red-500/10 text-red-400',     dot: '#ef4444' },
  skip:  { badge: 'bg-zinc-800 text-zinc-400',       dot: '#52525b' },
  error: { badge: 'bg-red-500/10 text-red-400',      dot: '#ef4444' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PipelineStep({ step }: { step: PipelineStepData }) {
  const [expanded, setExpanded] = useState(false)
  const style = STATUS_CLASSES[step.status] ?? STATUS_CLASSES.skip

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
        style={{ background: expanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.01)' }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-xs">{STEP_ICONS[step.step] ?? '•'}</span>
        <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
          {String(step.step).padStart(2, '0')}
        </span>
        <span className="text-xs font-mono font-medium flex-1 text-left" style={{ color: 'var(--bb-text-2)' }}>
          {step.name}
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${style.badge}`}>
            {step.status}
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
            {step.durationMs}ms
          </span>
          {expanded
            ? <ChevronDown size={11} style={{ color: 'var(--bb-text-3)' }} />
            : <ChevronRight size={11} style={{ color: 'var(--bb-text-3)' }} />
          }
        </span>
      </button>

      {expanded && (
        <div
          className="px-4 py-2.5 overflow-x-auto"
          style={{ background: '#070707', borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <pre
            className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed"
            style={{ color: '#7dd3fc' }}
          >
            {JSON.stringify(step.data, null, 2)}
          </pre>
          {step.blockedResponse && (
            <div
              className="mt-2 text-xs font-mono px-2 py-1.5 rounded"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
            >
              blocked: {step.blockedResponse}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
