'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, X, BookOpen, FileText } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NormalizedStep {
  step: number
  name: string
  status: 'pass' | 'block' | 'skip' | 'error'
  durationMs: number
  data: Record<string, unknown>
  blockedResponse?: string
}

interface PipelinePanelProps {
  steps: NormalizedStep[] | null
  ragChunks: Array<{ id: string; content: string }> | null
  intent: string | null
  language: string | null
  ragFound: boolean
  latencyMs: number
  totalDurationMs: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_ICONS: Record<number, string> = {
  1: '🕐', 2: '🛡️', 3: '🔍', 4: '🔀',
  5: '❓', 6: '📚', 7: '🌐', 8: '📅',
  9: '📝', 10: '🤖',
}

const STATUS_STYLE: Record<string, { badge: string; color: string }> = {
  pass:  { badge: 'bg-green-500/10 text-green-400',  color: '#22c55e' },
  block: { badge: 'bg-red-500/10 text-red-400',      color: '#ef4444' },
  skip:  { badge: 'bg-zinc-800 text-zinc-500',        color: '#52525b' },
  error: { badge: 'bg-red-500/10 text-red-400',      color: '#ef4444' },
}

const DISPLAY_STATUS: Record<string, string> = {
  pass: 'completed', block: 'blocked', skip: 'skipped', error: 'error',
}

// ─── Sheet overlay ────────────────────────────────────────────────────────────

function Sheet({
  title,
  content,
  onClose,
}: {
  title: string
  content: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="ml-auto flex flex-col"
        style={{
          width: 'min(680px, 95vw)',
          height: '100dvh',
          background: 'var(--bb-surface)',
          borderLeft: '1px solid var(--bb-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            {title}
          </span>
          <button onClick={onClose} style={{ color: 'var(--bb-text-3)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <pre
            className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed"
            style={{ color: '#a5f3fc' }}
          >
            {content}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ─── StepRow ──────────────────────────────────────────────────────────────────

function StepRow({
  step,
  index,
  ragChunks,
}: {
  step: NormalizedStep
  index: number
  ragChunks: Array<{ id: string; content: string }> | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [sheet, setSheet] = useState<'rag' | 'prompt' | null>(null)

  const style = STATUS_STYLE[step.status] ?? STATUS_STYLE.skip
  const displayStatus = DISPLAY_STATUS[step.status] ?? step.status

  // Step 6: show RAG button if chunks are available
  const showRagButton = step.step === 6 && (ragChunks?.length ?? 0) > 0
  // Step 9: show Prompt button if system_prompt stored in data
  const showPromptButton = step.step === 9 && typeof step.data.system_prompt === 'string'

  const ragContent = ragChunks
    ?.map((c, i) => `--- Chunk ${i + 1} (${c.id.slice(0, 8)}…) ---\n${c.content}`)
    .join('\n\n') ?? ''

  const promptContent = typeof step.data.system_prompt === 'string'
    ? step.data.system_prompt
    : ''

  return (
    <>
      <div
        className="bb-step"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          animationDelay: `${index * 0.05}s`,
        }}
      >
        {/* Row header — click to expand */}
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
          style={{ background: expanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}
          onMouseEnter={e => {
            if (!expanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.01)'
          }}
          onMouseLeave={e => {
            if (!expanded) (e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
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
              {displayStatus}
            </span>
            <span className="text-xs font-mono w-14 text-right" style={{ color: 'var(--bb-text-3)' }}>
              {step.durationMs}ms
            </span>
            {expanded
              ? <ChevronDown size={11} style={{ color: 'var(--bb-text-3)' }} />
              : <ChevronRight size={11} style={{ color: 'var(--bb-text-3)' }} />
            }
          </span>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div
            className="px-4 py-3 overflow-x-auto"
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

            {/* Special action buttons */}
            {(showRagButton || showPromptButton) && (
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {showRagButton && (
                  <button
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: 'rgba(34,211,238,0.08)',
                      color: '#22d3ee',
                      border: '1px solid rgba(34,211,238,0.2)',
                    }}
                    onClick={e => { e.stopPropagation(); setSheet('rag') }}
                  >
                    <BookOpen size={11} />
                    View Full RAG Context
                  </button>
                )}
                {showPromptButton && (
                  <button
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: 'rgba(99,102,241,0.08)',
                      color: '#a78bfa',
                      border: '1px solid rgba(99,102,241,0.2)',
                    }}
                    onClick={e => { e.stopPropagation(); setSheet('prompt') }}
                  >
                    <FileText size={11} />
                    View Full Prompt
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sheets */}
      {sheet === 'rag' && (
        <Sheet
          title={`RAG Context — ${ragChunks?.length ?? 0} chunk${(ragChunks?.length ?? 0) !== 1 ? 's' : ''}`}
          content={ragContent}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'prompt' && (
        <Sheet
          title="System Prompt"
          content={promptContent}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

// ─── PipelinePanel ────────────────────────────────────────────────────────────

export function PipelinePanel({
  steps,
  ragChunks,
  intent,
  language,
  ragFound,
  latencyMs,
  totalDurationMs,
}: PipelinePanelProps) {
  // null = no message sent yet; [] = message sent but no step data available
  if (steps === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: 'var(--bb-surface-2)' }}
        >
          🔬
        </div>
        <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
          Send a message to see the pipeline
        </p>
      </div>
    )
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: 'var(--bb-surface-2)' }}
        >
          📊
        </div>
        <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>Pipeline ran</p>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {intent && (
            <span className="text-xs font-mono px-2 py-1 rounded"
              style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
              {intent}
            </span>
          )}
          {language && (
            <span className="text-xs font-mono px-2 py-1 rounded uppercase"
              style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}>
              {language}
            </span>
          )}
          {ragFound && (
            <span className="text-xs font-mono px-2 py-1 rounded"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
              rag hit
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          Step detail data not available
        </p>
      </div>
    )
  }

  const stepCount = steps.length
  const errorCount = steps.filter(s => s.status === 'error').length

  return (
    <>
      <style>{`
        @keyframes bb-step-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bb-step {
          animation: bb-step-in 0.2s ease both;
        }
      `}</style>

      <div className="flex flex-col h-full">
        {/* Steps list */}
        <div
          className="flex-1 overflow-y-auto rounded-t-lg"
          style={{ background: '#0a0a0a', border: '1px solid var(--bb-border-subtle)' }}
        >
          {steps.map((step, i) => (
            <StepRow
              key={step.step}
              step={step}
              index={i}
              ragChunks={ragChunks}
            />
          ))}
        </div>

        {/* Summary row */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-b-lg flex-shrink-0 flex-wrap"
          style={{
            background: 'var(--bb-surface-2)',
            border: '1px solid var(--bb-border-subtle)',
            borderTop: 'none',
          }}
        >
          <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
            {stepCount} step{stepCount !== 1 ? 's' : ''}
          </span>

          <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>·</span>

          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
          >
            {totalDurationMs || latencyMs}ms total
          </span>

          {errorCount > 0 && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
            >
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}

          <span className="flex-1" />

          {intent && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}
            >
              {intent}
            </span>
          )}

          {language && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded uppercase"
              style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
            >
              {language}
            </span>
          )}

          {ragFound && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
            >
              rag hit
            </span>
          )}
        </div>
      </div>
    </>
  )
}
