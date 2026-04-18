'use client'

import { useState } from 'react'
import { Pencil, Trash2, Image } from 'lucide-react'

type MediaTriggerWithPreview = {
  id: string
  trigger_value: string
  caption: string | null
  display_order: number
  is_active: boolean
  signed_preview_url: string | null
  file_size_bytes: number
}

interface Props {
  trigger: MediaTriggerWithPreview
  onToggleActive: () => void
  onEdit: () => void
  onDelete: () => void
}

const TRIGGER_COLORS = {
  skeptical: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  confirmed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaCard({ trigger, onToggleActive, onEdit, onDelete }: Props) {
  const [imgError, setImgError] = useState(false)

  const colors = TRIGGER_COLORS[trigger.trigger_value as keyof typeof TRIGGER_COLORS] ?? {
    bg: 'rgba(99,102,241,0.15)',
    text: '#818cf8',
  }

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--bb-surface)',
        border: '1px solid var(--bb-border)',
        opacity: trigger.is_active ? 1 : 0.55,
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{ height: '140px', background: 'var(--bb-surface-2)' }}
      >
        {trigger.signed_preview_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trigger.signed_preview_url}
            alt={trigger.caption ?? 'Media trigger'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Image size={32} style={{ color: 'var(--bb-text-3)' }} />
        )}

        {/* Active dot */}
        <button
          onClick={onToggleActive}
          title={trigger.is_active ? 'Click to deactivate' : 'Click to activate'}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: trigger.is_active ? 'var(--bb-success)' : 'var(--bb-surface-3)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full bg-white"
            style={{ opacity: trigger.is_active ? 1 : 0.5 }}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p
          className="text-xs leading-snug line-clamp-2"
          style={{
            color: trigger.caption ? 'var(--bb-text-1)' : 'var(--bb-text-3)',
            fontStyle: trigger.caption ? 'normal' : 'italic',
            minHeight: '2.5em',
          }}
        >
          {trigger.caption ?? 'No caption'}
        </p>

        <div className="flex items-center justify-between">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ background: colors.bg, color: colors.text }}
          >
            {trigger.trigger_value}
          </span>
          <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
            #{trigger.display_order}
          </span>
        </div>

        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          {formatBytes(trigger.file_size_bytes)}
        </p>

        {/* Actions */}
        <div
          className="flex items-center gap-1.5 mt-auto pt-2"
          style={{ borderTop: '1px solid var(--bb-border-subtle)' }}
        >
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded flex-1 justify-center transition-colors"
            style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
          >
            <Pencil size={11} />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded flex-1 justify-center transition-colors"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--bb-danger)' }}
          >
            <Trash2 size={11} />
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
