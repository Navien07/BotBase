'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Upload,
  Link2,
  Trash2,
  FileText,
  Globe,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Plus,
  X,
  Package,
  Edit2,
} from 'lucide-react'
import type { Document, Product } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocRow = Pick<
  Document,
  'id' | 'filename' | 'mime_type' | 'category' | 'status' | 'chunk_count' | 'error_message' | 'created_at'
>

type ProductRow = Pick<
  Product,
  'id' | 'name' | 'category' | 'description' | 'price' | 'currency' | 'image_url' | 'pdf_url' | 'is_active'
>

interface ProductForm {
  name: string
  category: string
  description: string
  price: string
  currency: string
  image_url: string
  pdf_url: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'text/html': 'URL',
}

const ALLOWED_ACCEPT = '.pdf,.docx,.txt,.csv'
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])
const MAX_FILE_SIZE = 10 * 1024 * 1024

const EMPTY_FORM: ProductForm = {
  name: '',
  category: '',
  description: '',
  price: '',
  currency: 'MYR',
  image_url: '',
  pdf_url: '',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string; pulse?: boolean }> = {
    pending: { bg: 'rgba(245,158,11,0.1)', color: 'var(--bb-warning)', label: 'Pending' },
    processing: { bg: 'rgba(99,102,241,0.1)', color: 'var(--bb-primary)', label: 'Processing', pulse: true },
    ready: { bg: 'rgba(34,197,94,0.1)', color: 'var(--bb-success)', label: 'Ready' },
    failed: { bg: 'rgba(239,68,68,0.1)', color: 'var(--bb-danger)', label: 'Failed' },
  }
  const s = map[status] ?? map.pending

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: s.color }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: s.color }}
          />
        </span>
      ) : status === 'ready' ? (
        <CheckCircle className="w-3 h-3" />
      ) : status === 'failed' ? (
        <AlertCircle className="w-3 h-3" />
      ) : (
        <Clock className="w-3 h-3" />
      )}
      {s.label}
    </span>
  )
}

function TypeBadge({ mimeType, category }: { mimeType: string | null; category: string }) {
  const label = category === 'url' ? 'URL' : (mimeType ? MIME_LABELS[mimeType] : '—')
  const isUrl = category === 'url'
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono"
      style={{
        background: isUrl ? 'rgba(34,211,238,0.1)' : 'var(--bb-surface-3)',
        color: isUrl ? 'var(--bb-accent)' : 'var(--bb-text-2)',
      }}
    >
      {isUrl ? <Globe className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
      {label}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const { botId } = useParams<{ botId: string }>()
  const [activeTab, setActiveTab] = useState<'documents' | 'products'>('documents')

  // Documents
  const [docs, setDocs] = useState<DocRow[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null) // filename being uploaded
  const [urlInput, setUrlInput] = useState('')
  const [scraping, setScraping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Products
  const [products, setProducts] = useState<ProductRow[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_FORM)
  const [savingProduct, setSavingProduct] = useState(false)

  const supabase = createClient()

  // ─── Fetch documents ────────────────────────────────────────────────────

  const fetchDocs = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, filename, mime_type, category, status, chunk_count, error_message, created_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('fetchDocs error', error)
      return
    }
    setDocs((data as DocRow[]) ?? [])
  }, [botId, supabase])

  useEffect(() => {
    fetchDocs().finally(() => setDocsLoading(false))
  }, [fetchDocs])

  // Auto-poll every 3s while any doc is pending/processing
  useEffect(() => {
    const hasActive = docs.some(
      (d) => d.status === 'pending' || d.status === 'processing'
    )
    if (!hasActive) return

    const id = setInterval(fetchDocs, 3000)
    return () => clearInterval(id)
  }, [docs, fetchDocs])

  // ─── Fetch products ──────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, description, price, currency, image_url, pdf_url, is_active')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('fetchProducts error', error)
    } else {
      setProducts((data as ProductRow[]) ?? [])
    }
    setProductsLoading(false)
  }, [botId, supabase])

  useEffect(() => {
    if (activeTab === 'products') fetchProducts()
  }, [activeTab, fetchProducts])

  // ─── File upload ─────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files)
    for (const file of list) {
      if (!ALLOWED_MIME.has(file.type)) {
        toast.error(`${file.name}: unsupported file type`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: exceeds 10 MB limit`)
        continue
      }
      await uploadFile(file)
    }
  }

  async function uploadFile(file: File) {
    setUploading(file.name)
    try {
      // 1. Create document record + get signed upload URL
      const metaRes = await fetch(`/api/ingest/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      })

      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error ?? 'Failed to initiate upload')
      }

      const { documentId, token, path } = await metaRes.json()

      // 2. Upload directly to Supabase Storage via signed URL
      const { error: uploadError } = await supabase.storage
        .from('bot-files')
        .uploadToSignedUrl(path, token, file, { contentType: file.type })

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      // Show doc optimistically as processing
      await fetchDocs()

      // 3. Trigger processing
      const processRes = await fetch(`/api/ingest/${botId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })

      if (!processRes.ok) {
        const err = await processRes.json().catch(() => ({ error: 'Processing failed' }))
        throw new Error(err.error ?? 'Processing failed')
      }

      const { chunkCount } = await processRes.json()
      toast.success(`${file.name} processed — ${chunkCount} chunks`)
      await fetchDocs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
      await fetchDocs()
    } finally {
      setUploading(null)
    }
  }

  // ─── URL scrape ──────────────────────────────────────────────────────────

  async function handleScrape() {
    const url = urlInput.trim()
    if (!url) return

    try {
      new URL(url)
    } catch {
      toast.error('Enter a valid URL')
      return
    }

    setScraping(true)
    try {
      const res = await fetch(`/api/ingest/${botId}/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scrape failed' }))
        throw new Error(err.error ?? 'Scrape failed')
      }

      const { chunkCount } = await res.json()
      toast.success(`URL scraped — ${chunkCount} chunks`)
      setUrlInput('')
      await fetchDocs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scrape failed')
    } finally {
      setScraping(false)
    }
  }

  // ─── Delete document ─────────────────────────────────────────────────────

  async function handleDeleteDoc(id: string) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) {
      toast.error('Failed to delete document')
      return
    }
    toast.success('Document deleted')
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  // ─── Product CRUD ─────────────────────────────────────────────────────────

  function openAddProduct() {
    setEditingProduct(null)
    setProductForm(EMPTY_FORM)
    setShowSheet(true)
  }

  function openEditProduct(p: ProductRow) {
    setEditingProduct(p)
    setProductForm({
      name: p.name,
      category: p.category ?? '',
      description: p.description ?? '',
      price: p.price != null ? String(p.price) : '',
      currency: p.currency ?? 'MYR',
      image_url: p.image_url ?? '',
      pdf_url: p.pdf_url ?? '',
    })
    setShowSheet(true)
  }

  async function handleSaveProduct() {
    if (!productForm.name.trim()) {
      toast.error('Product name is required')
      return
    }

    setSavingProduct(true)
    const payload = {
      bot_id: botId,
      name: productForm.name.trim(),
      category: productForm.category.trim() || null,
      description: productForm.description.trim() || null,
      price: productForm.price ? parseFloat(productForm.price) : null,
      currency: productForm.currency || 'MYR',
      image_url: productForm.image_url.trim() || null,
      pdf_url: productForm.pdf_url.trim() || null,
      is_active: true,
    }

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id)
          .eq('bot_id', botId)
        if (error) throw error
        toast.success('Product updated')
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        toast.success('Product added')
      }
      setShowSheet(false)
      await fetchProducts()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save product'
      )
    } finally {
      setSavingProduct(false)
    }
  }

  async function handleDeleteProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) {
      toast.error('Failed to delete product')
      return
    }
    toast.success('Product deleted')
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  // ─── Drag-drop handlers ───────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function onDragLeave() {
    setDragOver(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="py-4 space-y-4">
      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bb-surface)' }}
      >
        {(['documents', 'products'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize"
            style={{
              background: activeTab === tab ? 'var(--bb-surface-3)' : 'transparent',
              color: activeTab === tab ? 'var(--bb-text-1)' : 'var(--bb-text-2)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Documents tab ── */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Upload zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
            style={{
              borderColor: dragOver ? 'var(--bb-primary)' : 'var(--bb-border)',
              background: dragOver ? 'rgba(99,102,241,0.05)' : 'var(--bb-surface)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--bb-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
                  Uploading <span style={{ color: 'var(--bb-text-1)' }}>{uploading}</span>…
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8" style={{ color: 'var(--bb-text-3)' }} />
                <p className="text-sm" style={{ color: 'var(--bb-text-1)' }}>
                  Drag &amp; drop files here, or{' '}
                  <span style={{ color: 'var(--bb-primary)' }}>browse</span>
                </p>
                <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                  PDF, DOCX, TXT, CSV · max 10 MB
                </p>
              </div>
            )}
          </div>

          {/* URL scraper */}
          <div
            className="rounded-xl border p-4 flex gap-3"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
          >
            <Globe className="w-4 h-4 mt-2.5 shrink-0" style={{ color: 'var(--bb-text-3)' }} />
            <input
              type="url"
              placeholder="https://example.com/page-to-scrape"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !scraping && handleScrape()}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--bb-text-1)' }}
            />
            <button
              onClick={handleScrape}
              disabled={scraping || !urlInput.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {scraping ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scraping…</>
              ) : (
                <><Link2 className="w-3.5 h-3.5" /> Scrape</>
              )}
            </button>
          </div>

          {/* Documents table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--bb-border)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
                Documents
                {docs.length > 0 && (
                  <span
                    className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
                  >
                    {docs.length}
                  </span>
                )}
              </span>
            </div>

            {docsLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--bb-text-3)' }} />
              </div>
            ) : docs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
                  No documents yet. Upload a file or scrape a URL above.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bb-border)' }}>
                    {['Name', 'Type', 'Status', 'Chunks', 'Date', ''].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-medium"
                        style={{ color: 'var(--bb-text-3)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b last:border-0 hover:bg-opacity-50 transition-colors"
                      style={{ borderColor: 'var(--bb-border-subtle)' }}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--bb-text-3)' }} />
                          <span
                            className="truncate"
                            style={{ color: 'var(--bb-text-1)' }}
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                        </div>
                        {doc.status === 'failed' && doc.error_message && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--bb-danger)' }}>
                            {doc.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge mimeType={doc.mime_type} category={doc.category} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span style={{ color: doc.chunk_count > 0 ? 'var(--bb-text-1)' : 'var(--bb-text-3)' }}>
                          {doc.chunk_count > 0 ? doc.chunk_count : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span style={{ color: 'var(--bb-text-3)' }}>
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--bb-text-3)' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Products tab ── */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
              Products are embedded and searchable by the bot.
            </p>
            <button
              onClick={openAddProduct}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          </div>

          {productsLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--bb-text-3)' }} />
            </div>
          ) : products.length === 0 ? (
            <div
              className="rounded-xl border p-12 text-center"
              style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
            >
              <Package className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--bb-text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
                No products yet. Add one to include it in bot responses.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border p-4 flex flex-col gap-3"
                  style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <div
                      className="w-full h-32 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--bb-surface-2)' }}
                    >
                      <Package className="w-8 h-8" style={{ color: 'var(--bb-text-3)' }} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
                        {p.name}
                      </p>
                      {!p.is_active && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)' }}
                        >
                          Inactive
                        </span>
                      )}
                    </div>
                    {p.category && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
                        {p.category}
                      </p>
                    )}
                    {p.description && (
                      <p
                        className="text-sm mt-1 line-clamp-2"
                        style={{ color: 'var(--bb-text-2)' }}
                      >
                        {p.description}
                      </p>
                    )}
                    {p.price != null && (
                      <p className="text-sm font-medium mt-1.5" style={{ color: 'var(--bb-text-1)' }}>
                        {p.currency} {p.price.toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--bb-border-subtle)' }}>
                    <button
                      onClick={() => openEditProduct(p)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--bb-text-2)', background: 'var(--bb-surface-2)' }}
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--bb-danger)', background: 'rgba(239,68,68,0.1)' }}
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Product sheet ── */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/60"
            onClick={() => !savingProduct && setShowSheet(false)}
          />
          {/* Drawer */}
          <div
            className="w-full max-w-md flex flex-col overflow-y-auto"
            style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--bb-border)' }}
            >
              <h3 className="font-semibold" style={{ color: 'var(--bb-text-1)' }}>
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h3>
              <button
                onClick={() => setShowSheet(false)}
                className="p-1 rounded-lg"
                style={{ color: 'var(--bb-text-3)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-4">
              {(
                [
                  { key: 'name', label: 'Name *', placeholder: 'e.g. GenQi Energy Booster', type: 'text' },
                  { key: 'category', label: 'Category', placeholder: 'e.g. Health & Wellness', type: 'text' },
                  { key: 'price', label: 'Price', placeholder: '0.00', type: 'number' },
                  { key: 'currency', label: 'Currency', placeholder: 'MYR', type: 'text' },
                  { key: 'image_url', label: 'Image URL', placeholder: 'https://…', type: 'url' },
                  { key: 'pdf_url', label: 'PDF URL', placeholder: 'https://…', type: 'url' },
                ] as const
              ).map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: 'var(--bb-text-2)' }}
                  >
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={productForm[key]}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none border transition-colors focus:border-indigo-500"
                    style={{
                      background: 'var(--bb-surface-2)',
                      borderColor: 'var(--bb-border)',
                      color: 'var(--bb-text-1)',
                    }}
                  />
                </div>
              ))}

              {/* Description textarea */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--bb-text-2)' }}
                >
                  Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Product description for the bot to reference…"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none border transition-colors focus:border-indigo-500 resize-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    borderColor: 'var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>
            </div>

            <div
              className="px-5 py-4 border-t shrink-0 flex gap-3"
              style={{ borderColor: 'var(--bb-border)' }}
            >
              <button
                onClick={() => setShowSheet(false)}
                disabled={savingProduct}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={savingProduct || !productForm.name.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 transition-opacity"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                {savingProduct ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                ) : (
                  editingProduct ? 'Save Changes' : 'Add Product'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
