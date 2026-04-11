'use client'

import { PipelineStep, type PipelineStepData } from './PipelineStep'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineDebugData {
  steps?: PipelineStepData[]
  intent?: string | null
  ragFound?: boolean
  guardrailTriggered?: boolean
  totalDurationMs?: number
  templateUsed?: string | null
  tokensIn?: number
  tokensOut?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PipelineDebug({ debug }: { debug: PipelineDebugData }) {
  const steps = debug.steps ?? []

  if (steps.length === 0) {
    return (
      <div
        className="px-3 py-2 text-xs font-mono rounded-lg"
        style={{
          background: '#0a0a0a',
          border: '1px solid var(--bb-border-subtle)',
          color: 'var(--bb-text-3)',
        }}
      >
        No pipeline data recorded for this message.
      </div>
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: '#0a0a0a', border: '1px solid var(--bb-border-subtle)' }}
    >
      {/* ── Header bar ────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-wrap"
        style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
      >
        {/* Format / template badge */}
        {debug.templateUsed && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
          >
            {debug.templateUsed}
          </span>
        )}

        {/* Guardrail badge */}
        {debug.guardrailTriggered && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
          >
            🛡️ guardrail
          </span>
        )}

        {/* Intent */}
        {debug.intent && (
          <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
            intent:{' '}
            <span style={{ color: '#a78bfa' }}>{debug.intent}</span>
          </span>
        )}

        {/* RAG */}
        {debug.ragFound !== undefined && (
          <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
            rag:{' '}
            <span style={{ color: debug.ragFound ? '#22c55e' : '#52525b' }}>
              {debug.ragFound ? 'hit' : 'miss'}
            </span>
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Token counts */}
        {debug.tokensIn !== undefined && (
          <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
            {debug.tokensIn} in
          </span>
        )}
        {debug.tokensOut !== undefined && (
          <span className="text-xs font-mono" style={{ color: 'var(--bb-text-3)' }}>
            {debug.tokensOut} out
          </span>
        )}

        {/* Total duration */}
        {debug.totalDurationMs !== undefined && (
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
          >
            {debug.totalDurationMs}ms
          </span>
        )}
      </div>

      {/* ── Steps ─────────────────────────────────────────────────────── */}
      {steps.map(step => (
        <PipelineStep key={step.step} step={step} />
      ))}
    </div>
  )
}
