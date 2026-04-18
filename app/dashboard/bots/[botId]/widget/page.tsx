'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Check, Bot, Send, X } from 'lucide-react'

interface WidgetConfig {
  primaryColor: string
  position: 'bottom-right' | 'bottom-left'
  bubbleStyle: 'rounded' | 'square'
  welcomeMessage: string
  quickReplies: string[]
  showBranding: boolean
  allowedDomains: string[]
}

const DEFAULTS: WidgetConfig = {
  primaryColor: '#6366f1',
  position: 'bottom-right',
  bubbleStyle: 'rounded',
  welcomeMessage: 'Hi there! How can I help you today? 👋',
  quickReplies: [],
  showBranding: true,
  allowedDomains: [],
}

// ─── Tag Input ────────────────────────────────────────────────────────────────
function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  const remove = (tag: string) => onChange(tags.filter(t => t !== tag))

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 rounded-lg min-h-[40px]"
      style={{ background: '#161616', border: '1px solid #242424' }}
    >
      {tags.map(tag => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          style={{ background: '#6366f120', color: '#a5b4fc' }}
        >
          {tag}
          <button onClick={() => remove(tag)} style={{ color: '#a0a0a0', lineHeight: 1 }}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); add() }
          if (e.key === ',' || e.key === ' ') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !input && tags.length) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="bg-transparent outline-none text-sm flex-1 min-w-[120px]"
        style={{ color: '#f0f0f0' }}
      />
    </div>
  )
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
      style={{
        background: copied ? '#22c55e20' : '#161616',
        color: copied ? '#22c55e' : '#a0a0a0',
        border: '1px solid #242424',
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
function LivePreview({ config, botName }: { config: WidgetConfig; botName: string }) {
  const primary = config.primaryColor
  const isLeft = config.position === 'bottom-left'
  const radius = config.bubbleStyle === 'rounded' ? '50%' : '12px'

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: '#080808', border: '1px solid #242424', height: 560 }}
    >
      {/* Chat window preview */}
      <div
        className="absolute flex flex-col"
        style={{
          bottom: 80,
          [isLeft ? 'left' : 'right']: 16,
          width: 280,
          height: 380,
          background: '#101010',
          borderRadius: 16,
          border: '1px solid #242424',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ background: '#0c0c0c', borderBottom: '1px solid #242424' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: primary + '33' }}
          >
            <Bot size={13} style={{ color: primary }} />
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: '#f0f0f0' }}>{botName}</p>
            <div className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px]" style={{ color: '#a0a0a0' }}>Online</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-3 space-y-2 overflow-hidden">
          {config.welcomeMessage && (
            <div className="flex gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: primary + '33' }}
              >
                <Bot size={10} style={{ color: primary }} />
              </div>
              <div
                className="px-2.5 py-2 text-[11px] leading-relaxed max-w-[200px]"
                style={{
                  background: '#161616',
                  border: '1px solid #242424',
                  borderRadius: '10px 10px 10px 3px',
                  color: '#f0f0f0',
                }}
              >
                {config.welcomeMessage}
              </div>
            </div>
          )}
          {config.quickReplies.slice(0, 3).map((qr, i) => (
            <div key={i} className={isLeft ? '' : 'flex justify-end'} style={{ paddingLeft: isLeft ? '20px' : 0 }}>
              <span
                className="inline-block px-2 py-1 text-[10px] rounded-full border"
                style={{ borderColor: primary + '66', color: primary, background: primary + '11' }}
              >
                {qr}
              </span>
            </div>
          ))}
        </div>

        {/* Input */}
        <div
          className="px-3 py-2"
          style={{ background: '#0c0c0c', borderTop: '1px solid #242424' }}
        >
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: '#161616', border: '1px solid #242424' }}
          >
            <span className="text-[11px] flex-1" style={{ color: '#505050' }}>Type a message…</span>
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: primary }}
            >
              <Send size={10} className="text-white" />
            </div>
          </div>
          {config.showBranding && (
            <p className="text-center mt-1 text-[9px]" style={{ color: '#505050' }}>
              Powered by <span style={{ color: '#a0a0a0' }}>IceBot</span>
            </p>
          )}
        </div>
      </div>

      {/* Bubble */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          bottom: 16,
          [isLeft ? 'left' : 'right']: 16,
          width: 48,
          height: 48,
          borderRadius: radius,
          background: primary,
          boxShadow: `0 4px 20px ${primary}66`,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WidgetConfigPage() {
  const params = useParams()
  const botId = params.botId as string

  const [config, setConfig] = useState<WidgetConfig>(DEFAULTS)
  const [botName, setBotName] = useState('Your Bot')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [embedTab, setEmbedTab] = useState<'script' | 'iframe'>('script')

  useEffect(() => {
    fetch(`/api/widget/${botId}/config`)
      .then(r => r.json())
      .then(data => {
        setBotName(data.botName ?? 'Your Bot')
        setConfig({
          primaryColor: data.primaryColor ?? DEFAULTS.primaryColor,
          position: data.position ?? DEFAULTS.position,
          bubbleStyle: data.bubbleStyle ?? DEFAULTS.bubbleStyle,
          welcomeMessage: data.welcomeMessage ?? DEFAULTS.welcomeMessage,
          quickReplies: data.quickReplies ?? DEFAULTS.quickReplies,
          showBranding: data.showBranding ?? DEFAULTS.showBranding,
          allowedDomains: [],
        })
      })
      .catch(() => toast.error('Failed to load widget config'))
      .finally(() => setLoading(false))
  }, [botId])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/widget/${botId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: config.primaryColor,
          position: config.position,
          bubble_style: config.bubbleStyle,
          welcome_message: config.welcomeMessage || null,
          quick_replies: config.quickReplies,
          show_branding: config.showBranding,
          allowed_domains: config.allowedDomains,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Widget config saved')
    } catch {
      toast.error('Failed to save config')
    } finally {
      setSaving(false)
    }
  }, [botId, config])

  const scriptCode = `<script src="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'}/widget-loader.js" data-bot-id="${botId}"></script>`
  const iframeCode = `<iframe src="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'}/chat/${botId}" width="400" height="700" frameborder="0"></iframe>`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#f0f0f0' }}>Web Widget</h1>
        <p className="text-sm mt-1" style={{ color: '#a0a0a0' }}>
          Configure the chat widget and embed it on your website.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Left: Settings ─── */}
        <div className="space-y-5">
          <div
            className="rounded-xl p-5 space-y-5"
            style={{ background: '#101010', border: '1px solid #242424' }}
          >
            {/* Primary Color */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#f0f0f0' }}>
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5"
                  style={{ background: '#161616' }}
                />
                <input
                  type="text"
                  value={config.primaryColor}
                  onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm w-32"
                  style={{ background: '#161616', border: '1px solid #242424', color: '#f0f0f0' }}
                />
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#f0f0f0' }}>
                Position
              </label>
              <select
                value={config.position}
                onChange={e => setConfig(c => ({ ...c, position: e.target.value as WidgetConfig['position'] }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: '#161616', border: '1px solid #242424', color: '#f0f0f0' }}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>

            {/* Bubble Style */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#f0f0f0' }}>
                Bubble Style
              </label>
              <select
                value={config.bubbleStyle}
                onChange={e => setConfig(c => ({ ...c, bubbleStyle: e.target.value as WidgetConfig['bubbleStyle'] }))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: '#161616', border: '1px solid #242424', color: '#f0f0f0' }}
              >
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
              </select>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#f0f0f0' }}>
                Welcome Message
              </label>
              <textarea
                value={config.welcomeMessage}
                onChange={e => setConfig(c => ({ ...c, welcomeMessage: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{ background: '#161616', border: '1px solid #242424', color: '#f0f0f0' }}
                placeholder="Hi there! How can I help you today?"
              />
            </div>

            {/* Quick Replies */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#f0f0f0' }}>
                Quick Replies
              </label>
              <p className="text-xs mb-2" style={{ color: '#505050' }}>
                Press Enter or comma to add. Max 10.
              </p>
              <TagInput
                tags={config.quickReplies}
                onChange={qr => setConfig(c => ({ ...c, quickReplies: qr }))}
                placeholder="e.g. Book appointment"
              />
            </div>

            {/* Show Branding */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: '#f0f0f0' }}>Show IceBot Branding</p>
                <p className="text-xs mt-0.5" style={{ color: '#505050' }}>
                  Display "Powered by IceBot" in the widget footer
                </p>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, showBranding: !c.showBranding }))}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ background: config.showBranding ? '#6366f1' : '#242424' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                  style={{ transform: config.showBranding ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {/* Allowed Domains */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#f0f0f0' }}>
                Allowed Domains
              </label>
              <p className="text-xs mb-2" style={{ color: '#505050' }}>
                Restrict widget to specific domains. Leave empty to allow all.
              </p>
              <TagInput
                tags={config.allowedDomains}
                onChange={d => setConfig(c => ({ ...c, allowedDomains: d }))}
                placeholder="e.g. mysite.com"
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-opacity"
            style={{ background: '#6366f1', color: '#fff', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* ─── Right: Preview + Embed ─── */}
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: '#f0f0f0' }}>Live Preview</p>
            <LivePreview config={config} botName={botName} />
          </div>

          {/* Embed Code */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid #242424' }}
          >
            <div className="flex" style={{ borderBottom: '1px solid #242424' }}>
              {(['script', 'iframe'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setEmbedTab(tab)}
                  className="flex-1 py-2.5 text-sm font-medium transition-colors capitalize"
                  style={{
                    background: embedTab === tab ? '#161616' : '#101010',
                    color: embedTab === tab ? '#f0f0f0' : '#a0a0a0',
                    borderBottom: embedTab === tab ? '2px solid #6366f1' : '2px solid transparent',
                  }}
                >
                  {tab === 'script' ? 'Script Embed' : 'iFrame Embed'}
                </button>
              ))}
            </div>
            <div className="p-4" style={{ background: '#101010' }}>
              <div className="flex items-start justify-between gap-3">
                <pre
                  className="text-xs flex-1 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
                  style={{
                    background: '#0c0c0c',
                    color: '#a5b4fc',
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid #1a1a1a',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {embedTab === 'script' ? scriptCode : iframeCode}
                </pre>
                <CopyButton text={embedTab === 'script' ? scriptCode : iframeCode} />
              </div>
              <p className="text-xs mt-3" style={{ color: '#505050' }}>
                {embedTab === 'script'
                  ? 'Paste this script tag before the closing </body> tag on your website.'
                  : 'Paste this iframe where you want the chat window to appear.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
