import type { CSSProperties } from 'react'

function SkeletonBar({ style }: { style?: CSSProperties }) {
  return (
    <div
      className="animate-pulse rounded"
      style={{ background: 'var(--bb-surface-3)', ...style }}
    />
  )
}

// ─── TableSkeleton ────────────────────────────────────────────────────────────

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 8, cols = 5 }: TableSkeletonProps) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--bb-border)', background: 'var(--bb-surface)' }}
    >
      {/* Header row */}
      <div
        className="flex gap-4 px-4 py-3"
        style={{ borderBottom: '1px solid var(--bb-border)', background: 'var(--bb-surface-2)' }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBar key={i} style={{ height: 12, flex: 1, maxWidth: i === 0 ? 120 : undefined }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-4 py-3"
          style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonBar key={j} style={{ height: 12, flex: 1, maxWidth: j === 0 ? 160 : undefined }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── CardGridSkeleton ─────────────────────────────────────────────────────────

interface CardGridSkeletonProps {
  count?: number
}

export function CardGridSkeleton({ count = 4 }: CardGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-5"
          style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
        >
          <SkeletonBar style={{ height: 12, width: '60%', marginBottom: 12 }} />
          <SkeletonBar style={{ height: 28, width: '80%', marginBottom: 10 }} />
          <SkeletonBar style={{ height: 10, width: '40%' }} />
        </div>
      ))}
    </div>
  )
}

// ─── ChatSkeleton ─────────────────────────────────────────────────────────────

const CHAT_BUBBLES = [
  { align: 'left',  width: '58%' },
  { align: 'right', width: '44%' },
  { align: 'left',  width: '66%' },
  { align: 'right', width: '36%' },
  { align: 'left',  width: '52%' },
  { align: 'right', width: '48%' },
] as const

export function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {CHAT_BUBBLES.map((msg, i) => (
        <div key={i} className={`flex ${msg.align === 'right' ? 'justify-end' : 'justify-start'}`}>
          <SkeletonBar style={{ height: 38, width: msg.width, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  )
}
