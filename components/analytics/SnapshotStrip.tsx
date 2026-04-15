'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageCircle,
  Users,
  MessageSquare,
  Send,
  CalendarCheck,
  Clock,
  Bell,
  Activity,
} from 'lucide-react'
import { KPICard } from './KPICard'

type Period = 'today' | '7d' | '30d'

interface MetricValue {
  value: number
  delta: number
  trend: 'up' | 'down' | 'neutral'
}

interface SnapshotData {
  period: string
  metrics: {
    conversations:     MetricValue
    leadsCollected:    MetricValue
    whatsappMessages:  MetricValue
    telegramMessages:  MetricValue
    confirmedBookings: MetricValue
    pendingBookings:   MetricValue
    followupsSent:     MetricValue
    responseRate:      MetricValue
  }
}

interface SnapshotStripProps {
  botId: string
  defaultPeriod?: Period
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: '7d',    value: '7d' },
  { label: '30d',   value: '30d' },
]

const CARD_CONFIG = [
  {
    key: 'conversations'    as const,
    label: 'Conversations',
    icon: <MessageCircle size={14} />,
    color: '#6366f1',
  },
  {
    key: 'leadsCollected'   as const,
    label: 'Leads Collected',
    icon: <Users size={14} />,
    color: '#22d3ee',
  },
  {
    key: 'whatsappMessages' as const,
    label: 'WhatsApp Messages',
    icon: <MessageSquare size={14} />,
    color: '#25d366',
  },
  {
    key: 'telegramMessages' as const,
    label: 'Telegram Messages',
    icon: <Send size={14} />,
    color: '#229ed9',
  },
  {
    key: 'confirmedBookings' as const,
    label: 'Confirmed Bookings',
    icon: <CalendarCheck size={14} />,
    color: '#22c55e',
  },
  {
    key: 'pendingBookings'  as const,
    label: 'Pending Bookings',
    icon: <Clock size={14} />,
    color: '#f59e0b',
  },
  {
    key: 'followupsSent'    as const,
    label: 'Follow-ups Sent',
    icon: <Bell size={14} />,
    color: '#a78bfa',
  },
  {
    key: 'responseRate'     as const,
    label: 'Response Rate',
    icon: <Activity size={14} />,
    color: '#6366f1',
    format: 'percent' as const,
  },
]

export function SnapshotStrip({ botId, defaultPeriod = '7d' }: SnapshotStripProps) {
  const [period, setPeriod]   = useState<Period>(defaultPeriod)
  const [data, setData]       = useState<SnapshotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchSnapshot = useCallback(async (p: Period) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/${botId}/snapshot?period=${p}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const json = await res.json() as SnapshotData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => {
    fetchSnapshot(period)
  }, [period, fetchSnapshot])

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#505050' }}>
          Performance Snapshot
        </p>

        {/* Period toggle */}
        <div
          className="flex items-center rounded-lg p-0.5 gap-0.5"
          style={{ background: '#161616', border: '1px solid #242424' }}
        >
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className="px-3 py-1 text-xs rounded-md transition-colors"
              style={{
                background: period === value ? '#242424' : 'transparent',
                color:      period === value ? '#f0f0f0' : '#505050',
                fontWeight: period === value ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <p className="text-xs" style={{ color: '#ef4444' }}>
          Failed to load snapshot: {error}
        </p>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-4">
        {CARD_CONFIG.map((cfg) => {
          const metric = data?.metrics[cfg.key]
          return (
            <KPICard
              key={cfg.key}
              label={cfg.label}
              value={loading ? undefined : (metric?.value ?? 0)}
              delta={metric?.delta}
              trend={metric?.trend}
              icon={cfg.icon}
              format={cfg.format}
              highlightColor={cfg.color}
            />
          )
        })}
      </div>
    </div>
  )
}
