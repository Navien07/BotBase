'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Copy, Check } from 'lucide-react'

// ─── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0"
      style={{
        background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bb-surface-3)',
        color: copied ? 'var(--bb-success)' : 'var(--bb-text-2)',
        border: '1px solid var(--bb-border)',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── CodeBlock ─────────────────────────────────────────────────────────────────

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div>
      {label && (
        <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-3)' }}>
          {label}
        </div>
      )}
      <div
        className="relative rounded-lg p-4 font-mono text-sm overflow-x-auto"
        style={{
          background: '#0a0a0a',
          border: '1px solid var(--bb-border)',
          color: 'var(--bb-text-2)',
        }}
      >
        <div className="absolute top-3 right-3">
          <CopyButton text={code} />
        </div>
        <pre className="whitespace-pre-wrap pr-20">{code}</pre>
      </div>
    </div>
  )
}

// ─── ReadOnlyField ──────────────────────────────────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--bb-text-3)' }}>
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none select-all"
          style={{
            background: 'var(--bb-surface-2)',
            border: '1px solid var(--bb-border)',
            color: 'var(--bb-text-2)',
          }}
        />
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ─── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bb-surface)', border: '1px solid var(--bb-border)' }}
    >
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--bb-text-1)' }}>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { botId } = useParams<{ botId: string }>()
  const [n8nTab, setN8nTab] = useState<'whatsapp' | 'telegram'>('whatsapp')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.icebot.ai'
  const chatEndpoint = `${appUrl}/api/chat/${botId}`

  const curlExample = `curl -X POST ${chatEndpoint} \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Hello","userId":"user123","channel":"web"}'`

  const n8nBody: Record<'whatsapp' | 'telegram', string> = {
    whatsapp: `{
  "message": "{{$json.message}}",
  "userId": "{{$json.from}}",
  "channel": "whatsapp"
}`,
    telegram: `{
  "message": "{{$json.message}}",
  "userId": "{{$json.from.id}}",
  "channel": "telegram"
}`,
  }

  const responseHeaders = [
    { header: 'X-Conversation-Id', description: 'Unique ID for the conversation session' },
    { header: 'X-Intent',          description: 'Detected intent of the user message' },
    { header: 'X-Language',        description: 'Detected language code (en / bm / zh)' },
    { header: 'X-Rag-Found',       description: 'Whether RAG retrieved relevant context (true/false)' },
  ]

  return (
    <div className="py-2 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>Integrations</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
          Connect your bot to external tools and workflows.
        </p>
      </div>

      {/* Webhook / Chat Endpoint */}
      <Section title="Chat API Endpoint">
        <ReadOnlyField label="Chat API Endpoint" value={chatEndpoint} />
        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          Send POST requests to this endpoint with your API key in the{' '}
          <code
            className="px-1 py-0.5 rounded font-mono"
            style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
          >
            X-API-Key
          </code>{' '}
          header to interact with this bot.
        </p>
      </Section>

      {/* cURL Example */}
      <Section title="API Usage — cURL Example">
        <CodeBlock code={curlExample} label="Example request" />
      </Section>

      {/* n8n Integration */}
      <Section title="n8n Integration">
        {/* Tabs */}
        <div className="flex gap-0 mb-4" style={{ borderBottom: '1px solid var(--bb-border)' }}>
          {(['whatsapp', 'telegram'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setN8nTab(tab)}
              className="px-4 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                color: n8nTab === tab ? 'var(--bb-primary)' : 'var(--bb-text-2)',
                borderBottom: n8nTab === tab ? '2px solid var(--bb-primary)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
            </button>
          ))}
        </div>

        <ReadOnlyField label="Webhook URL" value={chatEndpoint} />

        <CodeBlock
          code={n8nBody[n8nTab]}
          label="n8n HTTP Request node — Body (JSON)"
        />

        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          In n8n, use an <strong>HTTP Request</strong> node set to POST. Add header{' '}
          <code
            className="px-1 py-0.5 rounded font-mono"
            style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
          >
            X-API-Key
          </code>{' '}
          with your generated API key value. Pipe the {n8nTab === 'whatsapp' ? 'WhatsApp' : 'Telegram'}{' '}
          trigger output into this node.
        </p>
      </Section>

      {/* Response Headers Reference */}
      <Section title="Response Headers Reference">
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--bb-border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bb-surface-2)', borderBottom: '1px solid var(--bb-border)' }}>
                <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--bb-text-3)' }}>
                  Header
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--bb-text-3)' }}>
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {responseHeaders.map((row, i) => (
                <tr
                  key={row.header}
                  style={{ borderBottom: i < responseHeaders.length - 1 ? '1px solid var(--bb-border-subtle)' : 'none' }}
                >
                  <td className="px-4 py-3">
                    <code
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-accent)' }}
                    >
                      {row.header}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--bb-text-2)' }}>
                    {row.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
