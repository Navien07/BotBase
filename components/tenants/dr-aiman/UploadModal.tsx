'use client'

import { useState, useRef } from 'react'
import { X, Upload, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_SIZE_BYTES = 5 * 1024 * 1024

interface Props {
  botId: string
  defaultTrigger: 'skeptical' | 'confirmed'
  onClose: () => void
  onUploaded: () => void
}

function validateFile(f: File): string | null {
  if (f.size > MAX_SIZE_BYTES) {
    return `File too large (${(f.size / (1024 * 1024)).toFixed(1)} MB). Max 5 MB.`
  }
  if (!ALLOWED_MIME_TYPES.includes(f.type as typeof ALLOWED_MIME_TYPES[number])) {
    return 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'
  }
  return null
}

export function UploadModal({ botId, defaultTrigger, onClose, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [triggerValue, setTriggerValue] = useState<'skeptical' | 'confirmed'>(defaultTrigger)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  function handleFileChange(f: File | null) {
    if (!f) return
    const err = validateFile(f)
    if (err) {
      setFile(null)
      setFileError(err)
      return
    }
    setFile(f)
    setFileError(null)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('trigger_value', triggerValue)
      if (caption.trim()) form.append('caption', caption.trim())

      const res = await fetch(`/api/tenants/dr-aiman/media-triggers/${botId}/upload`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Upload failed (${res.status})`)
      }

      toast.success('Image uploaded')
      onUploaded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
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
            Upload Image
          </h2>
          <button onClick={onClose}>
            <X size={16} style={{ color: 'var(--bb-text-3)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
            style={{
              borderColor: fileError ? 'var(--bb-danger)' : 'var(--bb-border)',
              background: 'var(--bb-surface-2)',
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFileChange(e.dataTransfer.files[0] ?? null)
            }}
          >
            <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--bb-text-3)' }} />
            <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
              {file ? file.name : 'Drop image here or click to browse'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--bb-text-3)' }}>
              JPEG, PNG, WebP · Max 5 MB
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {fileError && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--bb-danger)' }}>
              <AlertCircle size={13} className="flex-shrink-0" />
              {fileError}
            </div>
          )}

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
              onChange={(e) => setTriggerValue(e.target.value as 'skeptical' | 'confirmed')}
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

          {/* Caption */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--bb-text-2)' }}
            >
              Caption{' '}
              <span style={{ color: 'var(--bb-text-3)', fontWeight: 400 }}>(optional)</span>
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
            onClick={handleUpload}
            disabled={!file || uploading}
            className="text-sm px-4 py-1.5 rounded font-medium disabled:opacity-50"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
