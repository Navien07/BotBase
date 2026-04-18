'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { MediaCard } from './MediaCard'
import { UploadModal } from './UploadModal'
import { EditModal } from './EditModal'
import type { BotMediaTrigger } from '@/types/database'

type MediaTriggerWithPreview = BotMediaTrigger & { signed_preview_url: string | null }

type ActiveTab = 'skeptical' | 'confirmed'

interface Props {
  botId: string
}

export function MediaTriggersView({ botId }: Props) {
  const [triggers, setTriggers] = useState<MediaTriggerWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('skeptical')
  const [showUpload, setShowUpload] = useState(false)
  const [editTarget, setEditTarget] = useState<MediaTriggerWithPreview | null>(null)

  const fetchTriggers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenants/dr-aiman/media-triggers/${botId}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setTriggers(data.triggers)
    } catch {
      toast.error('Failed to load media triggers')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { fetchTriggers() }, [fetchTriggers])

  async function handleToggleActive(id: string, current: boolean) {
    // Optimistic update
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: !current } : t))
    )
    try {
      const res = await fetch(`/api/tenants/dr-aiman/media-triggers/${botId}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure
      setTriggers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: current } : t))
      )
      toast.error('Failed to update')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this image? It will be deactivated and hidden from dispatch.')) return
    try {
      const res = await fetch(`/api/tenants/dr-aiman/media-triggers/${botId}/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setTriggers((prev) => prev.filter((t) => t.id !== id))
      toast.success('Image removed')
    } catch {
      toast.error('Failed to remove image')
    }
  }

  const skepticalCount = triggers.filter((t) => t.trigger_value === 'skeptical').length
  const confirmedCount = triggers.filter((t) => t.trigger_value === 'confirmed').length
  const filtered = triggers.filter((t) => t.trigger_value === activeTab)

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            Media Triggers
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            Auto-send images when patients express doubt or readiness. Fires once per conversation.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded font-medium flex-shrink-0"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          <Upload size={14} />
          Upload Image
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-0 mb-6"
        style={{ borderBottom: '1px solid var(--bb-border)' }}
      >
        {(['skeptical', 'confirmed'] as const).map((tab) => {
          const count = tab === 'skeptical' ? skepticalCount : confirmedCount
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2.5 text-sm font-medium capitalize transition-colors"
              style={{
                color: isActive ? 'var(--bb-primary)' : 'var(--bb-text-2)',
                borderBottom: isActive ? '2px solid var(--bb-primary)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab} ({count})
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{
                background: 'var(--bb-surface-2)',
                height: '220px',
                border: '1px solid var(--bb-border)',
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ border: '1px dashed var(--bb-border)' }}
        >
          <ImageOff size={32} style={{ color: 'var(--bb-text-3)' }} className="mb-3" />
          <p className="text-sm font-medium" style={{ color: 'var(--bb-text-2)' }}>
            No {activeTab} images yet
          </p>
          <p className="text-xs mt-1 text-center max-w-xs" style={{ color: 'var(--bb-text-3)' }}>
            Upload images to send when patients express{' '}
            {activeTab === 'skeptical' ? 'doubt about results' : 'readiness to book'}
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded"
            style={{
              background: 'var(--bb-surface-2)',
              border: '1px solid var(--bb-border)',
              color: 'var(--bb-text-2)',
            }}
          >
            <Upload size={12} />
            Upload Image
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((trigger) => (
            <MediaCard
              key={trigger.id}
              trigger={trigger}
              onToggleActive={() => handleToggleActive(trigger.id, trigger.is_active)}
              onEdit={() => setEditTarget(trigger)}
              onDelete={() => handleDelete(trigger.id)}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          botId={botId}
          defaultTrigger={activeTab}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false)
            fetchTriggers()
          }}
        />
      )}

      {editTarget && (
        <EditModal
          botId={botId}
          trigger={editTarget}
          onClose={() => setEditTarget(null)}
          onEdited={() => {
            setEditTarget(null)
            fetchTriggers()
          }}
        />
      )}
    </div>
  )
}
