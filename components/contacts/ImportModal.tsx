'use client'

import { useState, useRef } from 'react'
import { X, Upload, Download, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const CSV_TEMPLATE = `name,phone,email,channel,language,lead_stage,tags
John Doe,+60123456789,john@example.com,whatsapp,en,new,vip;interested
Jane Smith,+60187654321,,telegram,bm,engaged,`

interface Props {
  botId: string
  onClose: () => void
  onImported: () => void
}

export function ImportModal({ botId, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][] | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  function handleFileChange(f: File | null) {
    if (!f) return
    setFile(f)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').slice(0, 6).map((l) => l.split(',').map((c) => c.trim()))
      setPreview(lines)
    }
    reader.readAsText(f)
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contacts-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/contacts/${botId}/import`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Import failed')
      const data = await res.json()
      setResult(data)
      if (data.imported > 0) {
        toast.success(`${data.imported} contacts imported`)
        onImported()
      } else {
        toast.warning('No contacts imported')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl"
        style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
      >
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--bb-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>Import Contacts</h2>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--bb-text-3)' }} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
          >
            <Download size={13} />Download CSV template
          </button>

          {/* File drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
            style={{ borderColor: 'var(--bb-border)', background: 'var(--bb-surface-2)' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]) }}
          >
            <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--bb-text-3)' }} />
            <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
              {file ? file.name : 'Drop CSV file here or click to browse'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--bb-text-3)' }}>Max 5MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <div className="overflow-x-auto rounded">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--bb-surface-3)' }}>
                    {preview[0].map((h, i) => (
                      <th key={i} className="px-2 py-1.5 text-left font-medium" style={{ color: 'var(--bb-text-2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--bb-border)' }}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1.5 truncate max-w-[100px]" style={{ color: 'var(--bb-text-1)' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 5 && (
                <p className="text-xs px-2 py-1" style={{ color: 'var(--bb-text-3)' }}>
                  Showing first 5 rows…
                </p>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className="rounded-lg p-3 space-y-1"
              style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
            >
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={14} style={{ color: 'var(--bb-success)' }} />
                <span style={{ color: 'var(--bb-text-1)' }}>{result.imported} imported, {result.skipped} skipped</span>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <div key={i} className="flex items-start gap-1 text-xs" style={{ color: 'var(--bb-danger)' }}>
                      <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5" style={{ borderTop: '1px solid var(--bb-border)' }}>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded"
            style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="text-sm px-4 py-1.5 rounded font-medium disabled:opacity-50"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
