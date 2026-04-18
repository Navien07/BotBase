'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'

type MediaTrigger = {
  id: string
  trigger_value: string
  caption: string | null
  display_order: number
  is_active: boolean
}

interface Props {
  botId: string
  trigger: MediaTrigger
  onClose: () => void
  onEdited: () => void
}

export function EditModal({ botId, trigger, onClose, onEdited }: Props) {
  const [caption, setCaption] = useState(trigger.caption ?? '')
  const [triggerValue, setTriggerValue] = useState(trigger.trigger_value)
  const [displayOrder, setDisplayOrder] = useState(trigger.display_order)
  const [isActive, setIsActive] = useState(trigger.is_active)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenants/dr-aiman/media-triggers/${botId}/${trigger.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: caption.trim() || null,
          trigger_value: triggerValue,
          display_order: displayOrder,
          is_active: isActive,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Failed (${res.status})`)
      }
      toast.success('Saved')
      onEdited()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl"
        style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            Edit Image
          </h2>
          <button onClick={onClose}>
            <X size={16} style={{ color: 'var(--bb-text-3)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Caption */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--bb-text-2)' }}
            >
              Caption
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Real patient result — 4 weeks"
              maxLength={200}
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
              }}
            />
          </div>

          {/* Trigger */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--bb-text-2)' }}
            >
              Trigger
            </label>
            <select
              value={triggerValue}
              onChange={(e) => setTriggerValue(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
              }}
            >
              <option value="skeptical">Skeptical — patient expresses doubt</option>
              <option value="confirmed">Confirmed — patient is ready to book</option>
            </select>
          </div>

          {/* Display order */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--bb-text-2)' }}
            >
              Display Order
            </label>
            <input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) =>
                setDisplayOrder(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bb-text-3)' }}>
              Lower numbers send first.
            </p>
          </div>

          {/* Active toggle */}
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ background: 'var(--bb-surface-2)' }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>
                Active
              </p>
              <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                Inactive images are skipped but stay in the library
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className="relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0 ml-3"
              style={{ background: isActive ? 'var(--bb-success)' : 'var(--bb-surface-3)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: isActive ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 p-5"
          style={{ borderTop: '1px solid var(--bb-border)' }}
        >
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded"
            style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded font-medium disabled:opacity-50"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
