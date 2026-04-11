'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UploadCloud, FileText, CheckCircle, XCircle, Loader2, Link as LinkIcon } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadItem {
  id: string
  name: string
  status: 'uploading' | 'pending' | 'processing' | 'ready' | 'failed'
  error?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

function UploadDocsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const botId = searchParams.get('botId') ?? ''

  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [continuing, setContinuing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll while any doc is pending/processing
  const hasPending = uploads.some((u) => u.status === 'pending' || u.status === 'processing')
  const allDone = uploads.length === 0 || uploads.every((u) => u.status === 'ready' || u.status === 'failed')

  const refreshStatuses = useCallback(async () => {
    if (!botId) return
    try {
      const res = await fetch(`/api/ingest/${botId}`)
      if (!res.ok) return
      const { documents } = await res.json()
      if (!Array.isArray(documents)) return

      setUploads((prev) =>
        prev.map((u) => {
          const doc = documents.find(
            (d: { id: string; status: string; error?: string }) => d.id === u.id
          )
          if (!doc) return u
          return { ...u, status: doc.status, error: doc.error }
        })
      )
    } catch {/* ignore */}
  }, [botId])

  useEffect(() => {
    if (hasPending) {
      pollTimer.current = setInterval(refreshStatuses, 3000)
    } else {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [hasPending, refreshStatuses])

  async function uploadFile(file: File) {
    if (!botId) return

    const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!ALLOWED.includes(file.type)) {
      return
    }

    const tempId = crypto.randomUUID()
    setUploads((prev) => [...prev, { id: tempId, name: file.name, status: 'uploading' }])

    try {
      // 1. Register document → get upload URL
      const registerRes = await fetch(`/api/ingest/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      })

      if (!registerRes.ok) throw new Error('Failed to register document')
      const { documentId, uploadUrl } = await registerRes.json()

      // Replace temp ID with real document ID
      setUploads((prev) =>
        prev.map((u) => (u.id === tempId ? { ...u, id: documentId, status: 'pending' } : u))
      )

      // 2. Upload to storage
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      // 3. Trigger processing
      await fetch(`/api/ingest/${botId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })

      setUploads((prev) =>
        prev.map((u) => (u.id === documentId ? { ...u, status: 'processing' } : u))
      )
    } catch {
      setUploads((prev) =>
        prev.map((u) => (u.id === tempId ? { ...u, status: 'failed', error: 'Upload failed' } : u))
      )
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(uploadFile)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  async function handleUrlSubmit() {
    if (!url.trim() || !botId) return
    setUrlLoading(true)
    setUrlError('')

    try {
      const res = await fetch(`/api/ingest/${botId}/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to crawl URL')
      }

      const { documentId } = await res.json()
      const hostname = new URL(url.trim()).hostname
      setUploads((prev) => [...prev, { id: documentId, name: hostname, status: 'processing' }])
      setUrl('')
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to crawl URL')
    } finally {
      setUrlLoading(false)
    }
  }

  async function handleContinue() {
    if (!botId) return
    setContinuing(true)
    await fetch('/api/onboarding/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'upload_docs', botId }),
    }).catch(() => {})
    router.push(`/onboarding/configure?botId=${botId}`)
  }

  function statusIcon(status: UploadItem['status']) {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-[oklch(0.585_0.223_264.4)]" />
      case 'pending':
        return <Loader2 className="w-4 h-4 animate-spin text-[oklch(0.63_0_0)]" />
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-[oklch(0.720_0.190_142.5)]" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-[oklch(0.637_0.217_25.3)]" />
    }
  }

  function statusLabel(status: UploadItem['status']) {
    switch (status) {
      case 'uploading': return 'Uploading…'
      case 'pending': return 'Queued'
      case 'processing': return 'Processing…'
      case 'ready': return 'Ready'
      case 'failed': return 'Failed'
    }
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-[oklch(0.94_0_0)]">
          Add your knowledge base
        </h1>
        <p className="text-[oklch(0.63_0_0)] text-sm">
          Upload documents so your bot can answer questions accurately.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3 cursor-pointer transition-all',
          dragging
            ? 'border-[oklch(0.585_0.223_264.4)] bg-[oklch(0.585_0.223_264.4_/_0.05)]'
            : 'border-[oklch(0.2_0_0)] hover:border-[oklch(0.3_0_0)] bg-[oklch(0.09_0_0)]',
        ].join(' ')}
      >
        <UploadCloud className="w-10 h-10 text-[oklch(0.4_0_0)]" />
        <div className="text-center">
          <p className="text-[oklch(0.94_0_0)] text-sm font-medium">
            Drop files here or click to browse
          </p>
          <p className="text-[oklch(0.37_0_0)] text-xs mt-1">PDF, DOCX, TXT — max 10 MB each</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* URL input */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-[oklch(0.63_0_0)]">
          Or enter a website URL to crawl
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[oklch(0.37_0_0)]" />
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
              placeholder="https://yourwebsite.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!url.trim() || urlLoading}
            className="px-4 py-2.5 rounded-lg bg-[oklch(0.13_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] text-sm font-medium hover:border-[oklch(0.3_0_0)] disabled:opacity-50 transition-colors"
          >
            {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
          </button>
        </div>
        {urlError && <p className="text-xs text-[oklch(0.637_0.217_25.3)]">{urlError}</p>}
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[oklch(0.09_0_0)] border border-[oklch(0.165_0_0)]"
            >
              <FileText className="w-4 h-4 text-[oklch(0.585_0.223_264.4)] flex-shrink-0" />
              <span className="flex-1 text-sm text-[oklch(0.94_0_0)] truncate">{u.name}</span>
              <div className="flex items-center gap-2">
                <span className={[
                  'text-xs',
                  u.status === 'ready' ? 'text-[oklch(0.720_0.190_142.5)]' :
                  u.status === 'failed' ? 'text-[oklch(0.637_0.217_25.3)]' :
                  'text-[oklch(0.63_0_0)]',
                ].join(' ')}>
                  {statusLabel(u.status)}
                </span>
                {statusIcon(u.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Continue */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={!allDone || continuing}
        className="w-full py-3 rounded-lg bg-[oklch(0.585_0.223_264.4)] hover:bg-[oklch(0.52_0.223_264.4)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {continuing ? 'Saving…' : uploads.length === 0 ? 'Skip for now →' : 'Continue →'}
      </button>
    </div>
  )
}

export default function UploadDocsPage() {
  return (
    <Suspense>
      <UploadDocsPageInner />
    </Suspense>
  )
}
