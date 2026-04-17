'use client'

import { useState } from 'react'
import { formatDistanceToNow, format, isToday } from 'date-fns'
import { PipelineDebug, type PipelineDebugData } from './PipelineDebug'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageData {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  intent: string | null
  sentiment: string | null
  pipeline_debug: PipelineDebugData
  metadata?: { sent_by_agent?: boolean; agent_id?: string }
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SENTIMENT_ICON: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😟',
  frustrated: '😤',
}

/** Minimal markdown → React: handles **bold**, *italic*, `code`, newlines, bullets */
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, li) => {
    // Bullet list item
    const isBullet = /^[-*•]\s/.test(line)
    const lineText = isBullet ? line.replace(/^[-*•]\s/, '') : line

    // Process inline markdown
    const parts: React.ReactNode[] = []
    const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
    let last = 0
    let match: RegExpExecArray | null

    while ((match = inlineRe.exec(lineText)) !== null) {
      if (match.index > last) parts.push(lineText.slice(last, match.index))
      if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>)
      else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>)
      else if (match[4]) parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 rounded text-xs font-mono"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#7dd3fc' }}
        >
          {match[4]}
        </code>
      )
      last = match.index + match[0].length
    }
    if (last < lineText.length) parts.push(lineText.slice(last))

    return (
      <span key={li} className={`block ${isBullet ? 'pl-4' : ''}`}>
        {isBullet && <span className="mr-2 opacity-50">•</span>}
        {parts.length > 0 ? parts : '\u200B' /* zero-width space for empty lines */}
      </span>
    )
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageBubble({
  msg,
  showDebugByDefault = false,
}: {
  msg: MessageData
  showDebugByDefault?: boolean
}) {
  const isUser = msg.role === 'user'
  const isSentByAgent = msg.metadata?.sent_by_agent === true
  const hasDebug = !isUser && (msg.pipeline_debug?.steps?.length ?? 0) > 0

  // Default to 'pipeline' tab when debug mode is on, else 'response'
  const [activeTab, setActiveTab] = useState<'response' | 'pipeline'>(
    showDebugByDefault ? 'pipeline' : 'response'
  )

  const { relTime, absTime } = (() => {
    try {
      const d = new Date(msg.created_at)
      return {
        relTime: formatDistanceToNow(d, { addSuffix: true }),
        absTime: isToday(d) ? format(d, 'HH:mm') : format(d, 'dd MMM · HH:mm'),
      }
    } catch { return { relTime: '', absTime: '' } }
  })()

  return (
    <div className={`flex flex-col mb-5 ${isUser ? 'items-start' : 'items-end'}`}>
      <div className={`max-w-[72%] flex flex-col gap-1 ${isUser ? 'items-start' : 'items-end'}`}>

        {/* ── Bubble ──────────────────────────────────────────────────── */}
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
            isUser ? 'rounded-2xl rounded-tl-sm' : 'rounded-2xl rounded-tr-sm'
          }`}
          style={
            isUser
              ? { background: '#1e1e1e', color: 'var(--bb-text-1)' }
              : {
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  color: 'var(--bb-text-1)',
                }
          }
        >
          {msg.content}
          {isSentByAgent && (
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded align-middle"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
            >
              Agent
            </span>
          )}
        </div>

        {/* ── Meta row ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-0.5">
          <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>{absTime}</span>
          <span className="text-xs" style={{ color: 'var(--bb-text-3)', opacity: 0.5 }}>·</span>
          <span className="text-xs" style={{ color: 'var(--bb-text-3)', opacity: 0.5 }}>{relTime}</span>
          {msg.sentiment && SENTIMENT_ICON[msg.sentiment] && (
            <span className="text-xs">{SENTIMENT_ICON[msg.sentiment]}</span>
          )}
          {msg.intent && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)' }}
            >
              {msg.intent}
            </span>
          )}
          {(() => {
            const brochureStep = msg.pipeline_debug?.steps?.find(s => s.step === 11)
            if (!brochureStep || brochureStep.data?.triggered !== true) return null
            const lang = typeof brochureStep.data.language === 'string' ? brochureStep.data.language.toUpperCase() : ''
            return (
              <span
                className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
                title="PDF brochure dispatched to this conversation"
              >
                📄 Brochure{lang ? ` · ${lang}` : ''}
              </span>
            )
          })()}
        </div>

        {/* ── Response / Pipeline tab panel (bot messages only) ────────── */}
        {hasDebug && (
          <div className="w-full mt-1" style={{ minWidth: '320px', maxWidth: '520px' }}>
            {/* Tab strip */}
            <div
              className="flex"
              style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
            >
              {(['response', 'pipeline'] as const).map(tab => (
                <button
                  key={tab}
                  className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                  style={{
                    color: activeTab === tab ? 'var(--bb-primary)' : 'var(--bb-text-3)',
                    borderBottom: activeTab === tab
                      ? '2px solid var(--bb-primary)'
                      : '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="mt-2">
              {activeTab === 'response' && (
                <div
                  className="px-3 py-2.5 rounded-lg text-sm leading-relaxed"
                  style={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border-subtle)',
                    color: 'var(--bb-text-1)',
                  }}
                >
                  {renderMarkdown(msg.content)}
                </div>
              )}
              {activeTab === 'pipeline' && (
                <PipelineDebug debug={msg.pipeline_debug} />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
