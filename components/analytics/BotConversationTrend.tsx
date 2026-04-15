'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConversationChart } from './ConversationChart'

type Period = 'today' | '7d' | '30d'

interface Props {
  botId: string
}

function getPeriodRange(period: Period): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (period === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (period === '7d') {
    from.setDate(from.getDate() - 7)
  } else {
    from.setDate(from.getDate() - 30)
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
]

interface ConversationRow {
  date: string
  whatsapp: number
  telegram: number
  web: number
  api: number
}

export function BotConversationTrend({ botId }: Props) {
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = getPeriodRange(period)
      const res = await fetch(
        `/api/analytics/${botId}?report=conversations-by-channel&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      const json = await res.json() as { data?: ConversationRow[]; error?: string }
      setData(Array.isArray(json.data) ? json.data : [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [botId, period])

  useEffect(() => { load() }, [load])

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
          Conversation Trend
        </p>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background: period === p.value ? 'var(--bb-primary)' : 'var(--bb-surface-2)',
                color: period === p.value ? '#fff' : 'var(--bb-text-2)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <ConversationChart data={data} loading={loading} />
    </div>
  )
}
