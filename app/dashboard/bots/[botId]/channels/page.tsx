'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { MessageCircle, Send, Globe, CheckCircle, XCircle, Copy, Eye, EyeOff, Loader2, X } from 'lucide-react'

interface ChannelConfig {
  id: string
  channel: string
  is_active: boolean
  config: Record<string, string>
  updated_at: string
}

interface ChannelCardProps {
  channel: string
  icon: React.ReactNode
  title: string
  description: string
  config: ChannelConfig | null
  onConfigure: () => void
  note?: string
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        background: active ? 'rgba(34,197,94,0.1)' : 'rgba(80,80,80,0.2)',
        color: active ? 'var(--bb-success)' : 'var(--bb-text-3)',
      }}>
      {active
        ? <><CheckCircle className="w-3 h-3" /> Connected</>
        : <><XCircle className="w-3 h-3" /> Not configured</>
      }
    </span>
  )
}

function ChannelCard({ channel, icon, title, description, config, onConfigure, note }: ChannelCardProps) {
  return (
    <div className="rounded-xl p-5 border flex flex-col gap-4"
      style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bb-surface-2)' }}>
            {icon}
          </div>
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--bb-text-1)' }}>{title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-2)' }}>{description}</p>
          </div>
        </div>
        <StatusBadge active={!!config?.is_active} />
      </div>

      {note && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
          style={{
            background: 'rgba(34,211,238,0.05)',
            border: '1px solid rgba(34,211,238,0.15)',
            color: 'var(--bb-text-2)',
          }}
        >
          <span className="flex-shrink-0 mt-0.5">🎤</span>
          <span>{note}</span>
        </div>
      )}

      {config?.updated_at && (
        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          Last updated: {new Date(config.updated_at).toLocaleDateString()}
        </p>
      )}

      <button
        onClick={onConfigure}
        className="w-full py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
        style={{
          background: 'var(--bb-surface-2)',
          borderColor: 'var(--bb-border)',
          color: 'var(--bb-text-1)',
        }}>
        {config ? 'Reconfigure' : 'Configure'}
      </button>
    </div>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  function copy() {
    navigator.clipboard.writeText(value).then(() => toast.success('Copied!'))
  }
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          className="flex-1 px-3 py-2 rounded-lg text-xs border outline-none truncate"
          style={{ background: 'var(--bb-surface-3)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}
        />
        <button onClick={copy}
          className="p-2 rounded-lg border hover:opacity-80 transition-opacity"
          style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}>
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function PasswordInput({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-3 pr-9 py-2.5 rounded-lg text-sm border outline-none focus:ring-1 disabled:opacity-50"
          style={{
            background: 'var(--bb-surface-2)',
            borderColor: 'var(--bb-border)',
            color: 'var(--bb-text-1)',
          }}
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--bb-text-3)' }}>
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-2)' }}>
        {label}{required && <span style={{ color: 'var(--bb-danger)' }}> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1"
        style={{
          background: 'var(--bb-surface-2)',
          borderColor: 'var(--bb-border)',
          color: 'var(--bb-text-1)',
        }}
      />
    </div>
  )
}

// ─── WhatsApp Config Panel ─────────────────────────────────────────────────────

function WhatsAppPanel({ botId, existing, onSaved, onClose }: {
  botId: string; existing: ChannelConfig | null; onSaved: () => void; onClose: () => void
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(existing?.config.phone_number_id ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [wabaId, setWabaId] = useState(existing?.config.waba_id ?? '')
  const [appSecret, setAppSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedInfo, setSavedInfo] = useState<{ verify_token: string; webhook_url: string } | null>(null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!phoneNumberId || !accessToken) {
      toast.error('Phone Number ID and Access Token are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'whatsapp',
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          waba_id: wabaId || undefined,
          app_secret: appSecret || undefined,
        }),
      })
      const data = await res.json() as { success?: boolean; verify_token?: string; webhook_url?: string; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save')
        return
      }
      setSavedInfo({ verify_token: data.verify_token ?? '', webhook_url: data.webhook_url ?? '' })
      toast.success('WhatsApp connected successfully')
      onSaved()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <TextField label="Phone Number ID" value={phoneNumberId} onChange={setPhoneNumberId}
        placeholder="123456789012345" required />
      <PasswordInput label="Access Token" value={accessToken} onChange={setAccessToken}
        placeholder={existing ? '(unchanged — enter to update)' : 'EAAxxxxxxx...'} />
      <TextField label="WABA ID (optional)" value={wabaId} onChange={setWabaId}
        placeholder="123456789012345" />
      <PasswordInput label="App Secret (optional, for HMAC verification)" value={appSecret}
        onChange={setAppSecret} placeholder="Enter to set / update" />

      {savedInfo ? (
        <div className="rounded-lg p-4 border space-y-3"
          style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--bb-success)' }}>
            ✓ Connected! Add these to your WhatsApp Business app:
          </p>
          <CopyField label="Webhook URL" value={savedInfo.webhook_url} />
          <CopyField label="Verify Token" value={savedInfo.verify_token} />
        </div>
      ) : existing && (
        <div className="rounded-lg p-3 border" style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--bb-text-2)' }}>Webhook info:</p>
          <CopyField label="Webhook URL" value={`${appUrl}/api/webhook/whatsapp`} />
          {existing.config.verify_token && (
            <div className="mt-2">
              <CopyField label="Verify Token" value={existing.config.verify_token} />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-lg text-sm border transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save & Connect'}
        </button>
      </div>
    </form>
  )
}

// ─── Telegram Config Panel ─────────────────────────────────────────────────────

function TelegramPanel({ botId, existing, onSaved, onClose }: {
  botId: string; existing: ChannelConfig | null; onSaved: () => void; onClose: () => void
}) {
  const [botToken, setBotToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [settingUpWebhook, setSettingUpWebhook] = useState(false)
  const [savedUsername, setSavedUsername] = useState(existing?.config.bot_username ?? '')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!botToken) { toast.error('Bot Token is required'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'telegram', bot_token: botToken }),
      })
      const data = await res.json() as { success?: boolean; bot_username?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
      setSavedUsername(data.bot_username ?? '')
      toast.success(`Telegram bot @${data.bot_username} saved`)
      onSaved()
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }

  async function handleSetupWebhook() {
    if (!botToken && !existing) { toast.error('Save bot token first'); return }
    setSettingUpWebhook(true)
    try {
      const res = await fetch(`/api/webhook/telegram/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, botToken: botToken || undefined }),
      })
      const data = await res.json() as { success?: boolean; botUsername?: string; webhookUrl?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to setup webhook'); return }
      toast.success(`Webhook registered for @${data.botUsername}`)
      onSaved()
    } catch { toast.error('Network error') }
    finally { setSettingUpWebhook(false) }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <PasswordInput label="Bot Token" value={botToken} onChange={setBotToken}
        placeholder={existing ? '(unchanged — enter to update)' : '123456:ABCdefGHI...'} />

      {savedUsername && (
        <div className="flex items-center gap-2 text-sm py-2"
          style={{ color: 'var(--bb-success)' }}>
          <CheckCircle className="w-4 h-4" />
          <span>Connected as @{savedUsername}</span>
        </div>
      )}

      {existing && (
        <button type="button" onClick={handleSetupWebhook} disabled={settingUpWebhook}
          className="w-full py-2.5 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ borderColor: 'var(--bb-primary)', color: 'var(--bb-primary)', background: 'rgba(99,102,241,0.1)' }}>
          {settingUpWebhook && <Loader2 className="w-4 h-4 animate-spin" />}
          {settingUpWebhook ? 'Registering...' : '⚡ Setup Webhook (one-click)'}
        </button>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-lg text-sm border transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--bb-border)', color: 'var(--bb-text-2)' }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Token'}
        </button>
      </div>
    </form>
  )
}

// ─── Drawer (slide-in panel) ───────────────────────────────────────────────────

function Drawer({ title, open, onClose, children }: {
  title: string; open: boolean; onClose: () => void; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col overflow-y-auto"
        style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}>
        <div className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--bb-border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--bb-text-1)' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--bb-text-3)' }}
            className="hover:opacity-80 transition-opacity">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 flex-1">
          {children}
        </div>
      </div>
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const params = useParams()
  const botId = params.botId as string

  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDrawer, setActiveDrawer] = useState<'whatsapp' | 'telegram' | null>(null)

  const loadConfigs = useCallback(async () => {
    try {
      const res = await fetch(`/api/config/${botId}/channels`)
      const data = await res.json() as { configs?: ChannelConfig[] }
      setConfigs(data.configs ?? [])
    } catch {
      toast.error('Failed to load channel configs')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  const waConfig = configs.find((c) => c.channel === 'whatsapp') ?? null
  const tgConfig = configs.find((c) => c.channel === 'telegram') ?? null

  function handleSaved() {
    loadConfigs()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: 'var(--bb-text-3)' }}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>
          Channel Connections
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--bb-text-2)' }}>
          Connect messaging channels to start receiving and sending messages.
        </p>
      </div>

      <div className="grid gap-4">
        <ChannelCard
          channel="whatsapp"
          icon={<MessageCircle className="w-5 h-5" style={{ color: '#25d366' }} />}
          title="WhatsApp Business"
          description="Connect via WhatsApp Business API (Meta)"
          config={waConfig}
          onConfigure={() => setActiveDrawer('whatsapp')}
          note="Voice messages are supported. When a customer sends a voice note, it is automatically transcribed and processed. Ensure your n8n workflow passes the audio URL in the voice_url field of the webhook payload."
        />

        <ChannelCard
          channel="telegram"
          icon={<Send className="w-5 h-5" style={{ color: '#2aabee' }} />}
          title="Telegram Bot"
          description="Connect via Telegram Bot API"
          config={tgConfig}
          onConfigure={() => setActiveDrawer('telegram')}
          note="Voice messages are supported. When a customer sends a voice note, it is automatically transcribed and processed. Ensure your n8n workflow passes the audio URL in the voice_url field of the webhook payload."
        />

        <ChannelCard
          channel="web_widget"
          icon={<Globe className="w-5 h-5" style={{ color: 'var(--bb-primary)' }} />}
          title="Web Widget"
          description="Embed a chat widget on your website"
          config={null}
          onConfigure={() => toast.info('Widget configuration available in Phase 13')}
        />
      </div>

      <Drawer
        title="Configure WhatsApp Business"
        open={activeDrawer === 'whatsapp'}
        onClose={() => setActiveDrawer(null)}>
        <WhatsAppPanel
          botId={botId}
          existing={waConfig}
          onSaved={handleSaved}
          onClose={() => setActiveDrawer(null)}
        />
      </Drawer>

      <Drawer
        title="Configure Telegram Bot"
        open={activeDrawer === 'telegram'}
        onClose={() => setActiveDrawer(null)}>
        <TelegramPanel
          botId={botId}
          existing={tgConfig}
          onSaved={handleSaved}
          onClose={() => setActiveDrawer(null)}
        />
      </Drawer>
    </div>
  )
}
