'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  Plus,
  Copy,
  Check,
  Loader2,
  KeyRound,
  ShieldOff,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string
  label: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

// ─── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded transition-colors ${className}`}
      style={{ color: copied ? 'var(--bb-success)' : 'var(--bb-text-2)' }}
      title="Copy"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

// ─── GenerateDialog ────────────────────────────────────────────────────────────

interface GenerateDialogProps {
  botId: string
  onClose: () => void
  onCreated: () => void
}

function GenerateDialog({ botId, onClose, onCreated }: GenerateDialogProps) {
  const [step, setStep] = useState<'name' | 'reveal'>('name')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [rawKey, setRawKey] = useState('')

  const handleGenerate = async () => {
    if (!label.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/keys/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() }),
      })
      const data = await res.json() as { key?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate key')
      setRawKey(data.key!)
      setStep('reveal')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
      >
        {step === 'name' ? (
          <>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
              Generate API Key
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--bb-text-2)' }}>
              Give this key a descriptive name so you can identify it later.
            </p>
            <input
              type="text"
              placeholder="e.g. Production Bot, n8n Integration"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleGenerate() }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-4"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-1)',
              }}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ color: 'var(--bb-text-2)', background: 'var(--bb-surface-3)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!label.trim() || loading}
                className="px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Generate Key
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
              Copy your API Key
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--bb-text-2)' }}>
              This key will <strong style={{ color: 'var(--bb-warning)' }}>not be shown again</strong>.
              Copy it now and store it securely.
            </p>

            {/* Key display */}
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4 font-mono text-sm break-all"
              style={{
                background: '#0a0a0a',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-accent)',
              }}
            >
              <span className="flex-1 select-all">{rawKey}</span>
              <CopyButton text={rawKey} />
            </div>

            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-4 text-xs"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--bb-warning)' }}
            >
              <span>⚠</span>
              <span>Store this key somewhere safe. You cannot retrieve it after closing this dialog.</span>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              I&apos;ve copied this key
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── RevokeDialog ──────────────────────────────────────────────────────────────

interface RevokeDialogProps {
  botId: string
  keyId: string
  label: string
  onClose: () => void
  onRevoked: () => void
}

function RevokeDialog({ botId, keyId, label, onClose, onRevoked }: RevokeDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleRevoke = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/keys/${botId}/${keyId}/revoke`, { method: 'POST' })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to revoke')
      toast.success('API key revoked')
      onRevoked()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 shadow-2xl"
        style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
      >
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
          Revoke this key?
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--bb-text-2)' }}>
          <span className="font-medium" style={{ color: 'var(--bb-text-1)' }}>{label}</span> will
          stop working immediately. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg"
            style={{ color: 'var(--bb-text-2)', background: 'var(--bb-surface-3)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleRevoke}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--bb-danger)', color: '#fff' }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Revoke Key
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { botId } = useParams<{ botId: string }>()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/keys/${botId}`)
      const data = await res.json() as { keys?: ApiKey[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setKeys(data.keys ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load keys')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { void fetchKeys() }, [fetchKeys])

  return (
    <div className="py-2">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>API Keys</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
            Manage keys for authenticating API requests to this bot.
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          <Plus size={15} />
          Generate Key
        </button>
      </div>

      {/* Keys table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--bb-border)', background: 'var(--bb-surface)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--bb-text-3)' }} />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <KeyRound size={32} style={{ color: 'var(--bb-text-3)' }} />
            <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>No API keys yet</p>
            <button
              onClick={() => setShowGenerate(true)}
              className="text-sm font-medium"
              style={{ color: 'var(--bb-primary)' }}
            >
              Generate your first key
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bb-border)' }}>
                {['Name', 'Key', 'Status', 'Last Used', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium"
                    style={{ color: 'var(--bb-text-3)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const isRevoked = !!k.revoked_at
                return (
                  <tr
                    key={k.id}
                    style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
                  >
                    {/* Name */}
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--bb-text-1)' }}>
                      {k.label}
                    </td>

                    {/* Key (masked) */}
                    <td className="px-4 py-3">
                      <code
                        className="font-mono text-xs px-2 py-1 rounded"
                        style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
                      >
                        bb_live_••••••••{k.key_prefix}
                      </code>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={
                          isRevoked
                            ? { background: 'rgba(239,68,68,0.1)', color: 'var(--bb-danger)' }
                            : { background: 'rgba(34,197,94,0.1)', color: 'var(--bb-success)' }
                        }
                      >
                        {isRevoked ? 'Revoked' : 'Active'}
                      </span>
                    </td>

                    {/* Last Used */}
                    <td className="px-4 py-3" style={{ color: 'var(--bb-text-2)' }}>
                      {k.last_used_at
                        ? formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })
                        : <span style={{ color: 'var(--bb-text-3)' }}>Never</span>}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3" style={{ color: 'var(--bb-text-2)' }}>
                      {formatDistanceToNow(new Date(k.created_at), { addSuffix: true })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRevoking(k)}
                        disabled={isRevoked}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ color: 'var(--bb-danger)', background: 'rgba(239,68,68,0.08)' }}
                      >
                        <ShieldOff size={12} />
                        Revoke
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialogs */}
      {showGenerate && (
        <GenerateDialog
          botId={botId}
          onClose={() => setShowGenerate(false)}
          onCreated={fetchKeys}
        />
      )}
      {revoking && (
        <RevokeDialog
          botId={botId}
          keyId={revoking.id}
          label={revoking.label}
          onClose={() => setRevoking(null)}
          onRevoked={fetchKeys}
        />
      )}
    </div>
  )
}
