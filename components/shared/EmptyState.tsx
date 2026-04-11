'use client'

import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl"
      style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--bb-surface-2)' }}
      >
        <Icon size={22} style={{ color: 'var(--bb-text-3)' }} />
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
        {title}
      </h3>
      <p className="text-sm max-w-xs" style={{ color: 'var(--bb-text-2)' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bb-primary-h)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bb-primary)'
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
