'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Copy, CheckCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChannelType = 'whatsapp' | 'telegram' | 'web_widget'

interface ConnectResult {
  success?: boolean
  verify_token?: string
  webhook_url?: string
  bot_username?: string
  error?: string
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded text-[oklch(0.63_0_0)] hover:text-[oklch(0.94_0_0)] transition-colors"
    >
      {copied ? <CheckCircle className="w-4 h-4 text-[oklch(0.720_0.190_142.5)]" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

// ─── Read-only field with copy ─────────────────────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[oklch(0.63_0_0)]">{label}</label>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[oklch(0.06_0_0)] border border-[oklch(0.165_0_0)]">
        <span className="flex-1 text-xs text-[oklch(0.63_0_0)] font-mono truncate">{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

function ConnectChannelPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const botId = searchParams.get('botId') ?? ''

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'
  const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL ?? 'https://widget.icebot.ai'

  const [open, setOpen] = useState<ChannelType | null>(null)

  // WhatsApp state
  const [waNumber, setWaNumber] = useState('')
  const [waVerifyToken, setWaVerifyToken] = useState('')
  const [waConnecting, setWaConnecting] = useState(false)
  const [waResult, setWaResult] = useState<ConnectResult | null>(null)

  // Telegram state
  const [tgToken, setTgToken] = useState('')
  const [tgConnecting, setTgConnecting] = useState(false)
  const [tgResult, setTgResult] = useState<ConnectResult | null>(null)

  const [continuing, setContinuing] = useState(false)

  function toggle(ch: ChannelType) {
    setOpen((prev) => (prev === ch ? null : ch))
  }

  async function connectWhatsApp() {
    if (!botId || !waNumber.trim()) return
    setWaConnecting(true)
    setWaResult(null)
    try {
      const res = await fetch(`/api/config/${botId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'whatsapp',
          phone_number: waNumber.trim(),
          access_token: waVerifyToken.trim() || 'placeholder',
          verify_token: waVerifyToken.trim() || crypto.randomUUID(),
        }),
      })
      const data = await res.json() as ConnectResult
      setWaResult(data)
    } catch {
      setWaResult({ error: 'Connection failed' })
    } finally {
      setWaConnecting(false)
    }
  }

  async function connectTelegram() {
    if (!botId || !tgToken.trim()) return
    setTgConnecting(true)
    setTgResult(null)
    try {
      const res = await fetch(`/api/config/${botId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'telegram',
          bot_token: tgToken.trim(),
        }),
      })
      const data = await res.json() as ConnectResult
      setTgResult(data)
    } catch {
      setTgResult({ error: 'Connection failed' })
    } finally {
      setTgConnecting(false)
    }
  }

  async function handleContinue() {
    if (!botId) return
    setContinuing(true)
    await fetch('/api/onboarding/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'connect_channel', botId }),
    }).catch(() => {})
    router.push(`/onboarding/test?botId=${botId}`)
  }

  const widgetSnippet = `<script src="${WIDGET_URL}/widget.js" data-bot-id="${botId}" async></script>`

  const channels: Array<{ id: ChannelType; emoji: string; name: string; desc: string }> = [
    { id: 'whatsapp', emoji: '📱', name: 'WhatsApp', desc: 'Connect via WhatsApp Business API' },
    { id: 'telegram', emoji: '✈️', name: 'Telegram', desc: 'Connect your Telegram bot' },
    { id: 'web_widget', emoji: '🌐', name: 'Web Widget', desc: 'Embed on any website' },
  ]

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-[oklch(0.94_0_0)]">
          Connect a channel
        </h1>
        <p className="text-[oklch(0.63_0_0)] text-sm">
          Choose where your bot will chat with customers.
        </p>
      </div>

      {/* Channel cards */}
      <div className="space-y-3">
        {channels.map((ch) => (
          <div
            key={ch.id}
            className={[
              'rounded-xl border transition-all overflow-hidden',
              open === ch.id
                ? 'border-[oklch(0.585_0.223_264.4)] bg-[oklch(0.09_0_0)]'
                : 'border-[oklch(0.165_0_0)] bg-[oklch(0.09_0_0)] hover:border-[oklch(0.3_0_0)]',
            ].join(' ')}
          >
            {/* Card header — clickable */}
            <button
              type="button"
              onClick={() => toggle(ch.id)}
              className="w-full flex items-center gap-4 p-4 text-left"
            >
              <span className="text-2xl">{ch.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[oklch(0.94_0_0)]">{ch.name}</p>
                <p className="text-xs text-[oklch(0.63_0_0)]">{ch.desc}</p>
              </div>
              {open === ch.id
                ? <ChevronUp className="w-4 h-4 text-[oklch(0.63_0_0)]" />
                : <ChevronDown className="w-4 h-4 text-[oklch(0.63_0_0)]" />
              }
            </button>

            {/* Accordion body */}
            {open === ch.id && (
              <div className="px-4 pb-4 pt-0 space-y-3 border-t border-[oklch(0.165_0_0)]">
                {/* WhatsApp */}
                {ch.id === 'whatsapp' && (
                  <>
                    <ReadOnlyField
                      label="Webhook URL (copy into Meta Developer Portal)"
                      value={`${APP_URL}/api/webhook/whatsapp`}
                    />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[oklch(0.63_0_0)]">WhatsApp number</label>
                      <input
                        type="tel"
                        value={waNumber}
                        onChange={(e) => setWaNumber(e.target.value)}
                        placeholder="+60123456789"
                        className="w-full px-3 py-2 rounded-lg bg-[oklch(0.06_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[oklch(0.63_0_0)]">Access token</label>
                      <input
                        type="text"
                        value={waVerifyToken}
                        onChange={(e) => setWaVerifyToken(e.target.value)}
                        placeholder="EAAxxxxxxx…"
                        className="w-full px-3 py-2 rounded-lg bg-[oklch(0.06_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={connectWhatsApp}
                      disabled={waConnecting || !waNumber.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[oklch(0.585_0.223_264.4)] hover:bg-[oklch(0.52_0.223_264.4)] disabled:opacity-50 text-white text-sm font-medium transition-colors"
                    >
                      {waConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {waConnecting ? 'Connecting…' : 'Connect WhatsApp'}
                    </button>
                    {waResult?.error && (
                      <p className="text-xs text-[oklch(0.637_0.217_25.3)]">{waResult.error}</p>
                    )}
                    {waResult?.success && (
                      <p className="text-xs text-[oklch(0.720_0.190_142.5)]">✓ WhatsApp connected!</p>
                    )}
                  </>
                )}

                {/* Telegram */}
                {ch.id === 'telegram' && (
                  <>
                    <ReadOnlyField
                      label="Webhook URL (auto-registered)"
                      value={`${APP_URL}/api/webhook/telegram`}
                    />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[oklch(0.63_0_0)]">Bot token</label>
                      <input
                        type="text"
                        value={tgToken}
                        onChange={(e) => setTgToken(e.target.value)}
                        placeholder="123456:ABCdef…"
                        className="w-full px-3 py-2 rounded-lg bg-[oklch(0.06_0_0)] border border-[oklch(0.165_0_0)] text-[oklch(0.94_0_0)] placeholder:text-[oklch(0.37_0_0)] focus:outline-none focus:border-[oklch(0.585_0.223_264.4)] text-sm transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={connectTelegram}
                      disabled={tgConnecting || !tgToken.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[oklch(0.585_0.223_264.4)] hover:bg-[oklch(0.52_0.223_264.4)] disabled:opacity-50 text-white text-sm font-medium transition-colors"
                    >
                      {tgConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {tgConnecting ? 'Connecting…' : 'Connect Telegram'}
                    </button>
                    {tgResult?.error && (
                      <p className="text-xs text-[oklch(0.637_0.217_25.3)]">{tgResult.error}</p>
                    )}
                    {tgResult?.success && (
                      <p className="text-xs text-[oklch(0.720_0.190_142.5)]">✓ Telegram connected! @{tgResult.bot_username}</p>
                    )}
                  </>
                )}

                {/* Web Widget */}
                {ch.id === 'web_widget' && (
                  <>
                    <p className="text-xs text-[oklch(0.63_0_0)]">
                      Your web widget is auto-configured. Paste this snippet before the closing{' '}
                      <code className="text-[oklch(0.585_0.223_264.4)]">&lt;/body&gt;</code> tag.
                    </p>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[oklch(0.63_0_0)]">Embed snippet</label>
                      <div className="relative">
                        <pre className="px-3 py-3 pr-10 rounded-lg bg-[oklch(0.06_0_0)] border border-[oklch(0.165_0_0)] text-xs text-[oklch(0.63_0_0)] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                          {widgetSnippet}
                        </pre>
                        <div className="absolute top-2 right-2">
                          <CopyButton text={widgetSnippet} />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[oklch(0.720_0.190_142.5)]">✓ Web widget ready to embed</p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Continue */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={continuing}
        className="w-full py-3 rounded-lg bg-[oklch(0.585_0.223_264.4)] hover:bg-[oklch(0.52_0.223_264.4)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {continuing ? 'Saving…' : 'Continue →'}
      </button>
    </div>
  )
}

export default function ConnectChannelPage() {
  return (
    <Suspense>
      <ConnectChannelPageInner />
    </Suspense>
  )
}
