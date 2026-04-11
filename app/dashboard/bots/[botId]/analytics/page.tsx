'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import {
  MessageSquare, BarChart2, ShieldAlert, Globe,
  ThumbsUp, ThumbsDown, Download,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  conversations: number
  messages: number
  guardrails_triggered: number
  google_fallback_uses: number
}

interface VolumeRow   { day: string; count: number }
interface IntentRow   { intent: string; count: number }
interface LangRow     { language: string; count: number }
interface ChannelRow  { channel: string; count: number }
interface FunnelRow   { stage: string; count: number }
interface UnansweredRow { content: string; count: number }

interface AnalyticsState {
  kpi: KpiData | null
  volume: VolumeRow[]
  intents: IntentRow[]
  languages: LangRow[]
  channels: ChannelRow[]
  satisfaction: { thumbs_up: number; thumbs_down: number } | null
  funnel: FunnelRow[]
  unanswered: UnansweredRow[]
}

type Period = '7d' | '30d' | '90d'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'oklch(0.585 0.223 264.4)',  // indigo
  'oklch(0.845 0.145 196.4)',  // cyan
  'oklch(0.720 0.190 142.5)',  // green
  'oklch(0.780 0.175 55.0)',   // amber
  'oklch(0.637 0.217 25.3)',   // red
]

const INTENT_LABELS: Record<string, string> = {
  browse_product:    'Product Browse',
  book_appointment:  'Book Appointment',
  ask_pricing:       'Pricing Query',
  general_inquiry:   'General Inquiry',
  complaint:         'Complaint',
  greeting:          'Greeting',
  follow_up:         'Follow-up',
  cancel_booking:    'Cancel Booking',
  unknown:           'Unknown',
}

const STAGE_LABELS: Record<string, string> = {
  new:       'New',
  engaged:   'Engaged',
  qualified: 'Qualified',
  booked:    'Booked',
  converted: 'Converted',
  churned:   'Churned',
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp:   'WhatsApp',
  telegram:   'Telegram',
  web_widget: 'Web Widget',
  instagram:  'Instagram',
  facebook:   'Facebook',
  api:        'API',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodToDates(period: Period): { from: string; to: string } {
  const now = endOfDay(new Date())
  let from: Date
  if (period === '7d')  from = startOfDay(subDays(now, 6))
  else if (period === '30d') from = startOfDay(subDays(now, 29))
  else from = startOfDay(subMonths(now, 3))
  return { from: from.toISOString(), to: now.toISOString() }
}

function exportCsv(filename: string, rows: object[]) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv = [
    keys.join(','),
    ...rows.map(r => keys.map(k => JSON.stringify((r as Record<string, unknown>)[k] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--bb-surface-2)' }}
    />
  )
}

function CardShell({
  title,
  children,
  onExport,
  exportDisabled = false,
}: {
  title: string
  children: React.ReactNode
  onExport?: () => void
  exportDisabled?: boolean
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ color: 'var(--bb-text-1)', fontSize: '0.875rem', fontWeight: 600 }}>
          {title}
        </h3>
        {onExport && (
          <button
            onClick={onExport}
            disabled={exportDisabled}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-opacity disabled:opacity-40"
            style={{
              borderColor: 'var(--bb-border)',
              color: 'var(--bb-text-2)',
              background: 'transparent',
            }}
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div
      className="flex items-center justify-center py-10 text-sm"
      style={{ color: 'var(--bb-text-3)' }}
    >
      {message}
    </div>
  )
}

function ErrorState() {
  return (
    <div
      className="flex items-center justify-center py-10 text-sm"
      style={{ color: 'var(--bb-text-3)' }}
    >
      Could not load data
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ botId: string }>
}

export default function AnalyticsPage({ params }: Props) {
  const { botId } = use(params)

  const [period, setPeriod] = useState<Period>('7d')
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<string, boolean>>>({})
  const [data, setData] = useState<AnalyticsState>({
    kpi: null,
    volume: [],
    intents: [],
    languages: [],
    channels: [],
    satisfaction: null,
    funnel: [],
    unanswered: [],
  })

  const cache = useRef<Record<string, unknown>>({})

  const fetchReport = useCallback(
    async (report: string, from: string, to: string) => {
      const cacheKey = `${botId}:${from}:${to}:${report}`
      if (cache.current[cacheKey] !== undefined) {
        return { data: cache.current[cacheKey], fromCache: true }
      }
      const res = await fetch(
        `/api/analytics/${botId}?report=${report}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      if (!res.ok) throw new Error(`${report} failed: ${res.status}`)
      const json = await res.json() as { data: unknown }
      cache.current[cacheKey] = json.data
      return { data: json.data, fromCache: false }
    },
    [botId]
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    const { from, to } = periodToDates(period)
    const newErrors: Partial<Record<string, boolean>> = {}

    const results = await Promise.allSettled([
      fetchReport('kpi',             from, to),
      fetchReport('message-volume',  from, to),
      fetchReport('intent-breakdown',from, to),
      fetchReport('language-dist',   from, to),
      fetchReport('traffic-source',  from, to),
      fetchReport('satisfaction',    from, to),
      fetchReport('funnel',          from, to),
      fetchReport('unanswered',      from, to),
    ])

    const keys = [
      'kpi', 'volume', 'intents', 'languages',
      'channels', 'satisfaction', 'funnel', 'unanswered',
    ]

    const next = { ...data }
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        newErrors[keys[i]] = true
      } else {
        const v = r.value.data
        switch (keys[i]) {
          case 'kpi':          next.kpi = v as KpiData; break
          case 'volume':       next.volume = (v as VolumeRow[]) ?? []; break
          case 'intents':      next.intents = (v as IntentRow[]) ?? []; break
          case 'languages':    next.languages = (v as LangRow[]) ?? []; break
          case 'channels':     next.channels = (v as ChannelRow[]) ?? []; break
          case 'satisfaction': next.satisfaction = v as { thumbs_up: number; thumbs_down: number }; break
          case 'funnel':       next.funnel = (v as FunnelRow[]) ?? []; break
          case 'unanswered':   next.unanswered = (v as UnansweredRow[]) ?? []; break
        }
      }
    })

    setData(next)
    setErrors(newErrors)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, botId, fetchReport])

  useEffect(() => { void loadAll() }, [loadAll])

  // ── Export all ──
  function exportAll() {
    exportCsv('analytics-volume.csv', data.volume)
    exportCsv('analytics-intents.csv', data.intents)
    exportCsv('analytics-languages.csv', data.languages)
    exportCsv('analytics-channels.csv', data.channels)
    exportCsv('analytics-funnel.csv', data.funnel)
    exportCsv('analytics-unanswered.csv', data.unanswered)
  }

  // ── Period selector ──
  const PERIODS: { label: string; value: Period }[] = [
    { label: 'Last 7 days',  value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
  ]

  return (
    <div className="space-y-6 p-1">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 style={{ color: 'var(--bb-text-1)', fontWeight: 600, fontSize: '1.125rem' }}>
          Analytics
        </h2>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--bb-border)' }}
          >
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: period === p.value ? 'oklch(0.585 0.223 264.4)' : 'var(--bb-surface)',
                  color: period === p.value ? '#fff' : 'var(--bb-text-2)',
                  borderRight: '1px solid var(--bb-border)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Export all */}
          <button
            onClick={exportAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs"
            style={{
              borderColor: 'var(--bb-border)',
              color: 'var(--bb-text-2)',
              background: 'var(--bb-surface)',
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Export All CSV
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))
        ) : (
          [
            {
              label: 'Total Conversations',
              value: data.kpi?.conversations ?? 0,
              icon: MessageSquare,
              color: 'oklch(0.585 0.223 264.4)',
            },
            {
              label: 'Total Messages',
              value: data.kpi?.messages ?? 0,
              icon: BarChart2,
              color: 'oklch(0.845 0.145 196.4)',
            },
            {
              label: 'Guardrails Triggered',
              value: data.kpi?.guardrails_triggered ?? 0,
              icon: ShieldAlert,
              color: 'oklch(0.637 0.217 25.3)',
            },
            {
              label: 'Google Fallback Uses',
              value: data.kpi?.google_fallback_uses ?? 0,
              icon: Globe,
              color: 'oklch(0.780 0.175 55.0)',
            },
          ].map(kpi => (
            <div
              key={kpi.label}
              className="rounded-xl border p-4"
              style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                <span
                  className="text-xs"
                  style={{ color: 'var(--bb-text-2)' }}
                >
                  {kpi.label}
                </span>
              </div>
              <p
                className="text-2xl font-semibold"
                style={{ color: 'var(--bb-text-1)' }}
              >
                {kpi.value.toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* ── Row 2: Volume + Language dist ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversations Over Time */}
        <CardShell
          title="Conversations Over Time"
          onExport={() => exportCsv('analytics-volume.csv', data.volume)}
          exportDisabled={!data.volume.length}
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : errors['volume'] ? (
            <ErrorState />
          ) : !data.volume.length ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.volume}>
                <XAxis
                  dataKey="day"
                  tickFormatter={v => format(new Date(v), 'MMM d')}
                  tick={{ fontSize: 11, fill: 'oklch(0.37 0 0)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'oklch(0.37 0 0)' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    borderRadius: 8,
                    color: 'var(--bb-text-1)',
                    fontSize: 12,
                  }}
                  labelFormatter={v => format(new Date(String(v)), 'MMM d, yyyy')}
                />
                <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardShell>

        {/* Language Distribution */}
        <CardShell
          title="Language Distribution"
          onExport={() => exportCsv('analytics-languages.csv', data.languages)}
          exportDisabled={!data.languages.length}
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : errors['languages'] ? (
            <ErrorState />
          ) : !data.languages.length ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.languages}
                  dataKey="count"
                  nameKey="language"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {data.languages.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    borderRadius: 8,
                    color: 'var(--bb-text-1)',
                    fontSize: 12,
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span style={{ color: 'var(--bb-text-2)', fontSize: 12 }}>
                      {value.toUpperCase()}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardShell>
      </div>

      {/* ── Row 3: Satisfaction + Traffic ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Satisfaction */}
        <CardShell title="User Satisfaction">
          {loading ? (
            <Skeleton className="h-32" />
          ) : errors['satisfaction'] ? (
            <ErrorState />
          ) : !data.satisfaction ||
            (data.satisfaction.thumbs_up === 0 && data.satisfaction.thumbs_down === 0) ? (
            <EmptyState message="No ratings yet" />
          ) : (
            <div className="flex items-center gap-8 py-4">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.15)' }}
                >
                  <ThumbsUp className="w-6 h-6" style={{ color: 'oklch(0.720 0.190 142.5)' }} />
                </div>
                <p
                  className="text-2xl font-semibold"
                  style={{ color: 'var(--bb-text-1)' }}
                >
                  {data.satisfaction.thumbs_up.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: 'var(--bb-text-2)' }}>Positive</p>
              </div>
              <div
                className="h-12 w-px"
                style={{ background: 'var(--bb-border)' }}
              />
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.15)' }}
                >
                  <ThumbsDown className="w-6 h-6" style={{ color: 'oklch(0.637 0.217 25.3)' }} />
                </div>
                <p
                  className="text-2xl font-semibold"
                  style={{ color: 'var(--bb-text-1)' }}
                >
                  {data.satisfaction.thumbs_down.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: 'var(--bb-text-2)' }}>Negative</p>
              </div>
              {/* ratio bar */}
              {data.satisfaction.thumbs_up + data.satisfaction.thumbs_down > 0 && (
                <div className="flex-1">
                  <div
                    className="rounded-full overflow-hidden"
                    style={{ height: 8, background: 'var(--bb-surface-3)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(
                          (data.satisfaction.thumbs_up /
                            (data.satisfaction.thumbs_up + data.satisfaction.thumbs_down)) *
                            100
                        )}%`,
                        background: 'oklch(0.720 0.190 142.5)',
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1 text-right" style={{ color: 'var(--bb-text-3)' }}>
                    {Math.round(
                      (data.satisfaction.thumbs_up /
                        (data.satisfaction.thumbs_up + data.satisfaction.thumbs_down)) *
                        100
                    )}% positive
                  </p>
                </div>
              )}
            </div>
          )}
        </CardShell>

        {/* Traffic by Source */}
        <CardShell
          title="Traffic by Source"
          onExport={() => exportCsv('analytics-channels.csv', data.channels)}
          exportDisabled={!data.channels.length}
        >
          {loading ? (
            <Skeleton className="h-32" />
          ) : errors['channels'] ? (
            <ErrorState />
          ) : !data.channels.length ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={data.channels.map(c => ({
                  ...c,
                  channel: CHANNEL_LABELS[c.channel] ?? c.channel,
                }))}
                layout="vertical"
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'oklch(0.37 0 0)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="channel"
                  tick={{ fontSize: 11, fill: 'oklch(0.37 0 0)' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    borderRadius: 8,
                    color: 'var(--bb-text-1)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardShell>
      </div>

      {/* ── Row 4: Intent Breakdown + Lead Funnel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Intent Breakdown */}
        <CardShell
          title="Intent Breakdown"
          onExport={() => exportCsv('analytics-intents.csv', data.intents)}
          exportDisabled={!data.intents.length}
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : errors['intents'] ? (
            <ErrorState />
          ) : !data.intents.length ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.intents.slice(0, 5).map(i => ({
                  ...i,
                  intent: INTENT_LABELS[i.intent] ?? i.intent,
                }))}
                layout="vertical"
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'oklch(0.37 0 0)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="intent"
                  tick={{ fontSize: 11, fill: 'oklch(0.37 0 0)' }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bb-surface-2)',
                    border: '1px solid var(--bb-border)',
                    borderRadius: 8,
                    color: 'var(--bb-text-1)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardShell>

        {/* Lead Conversion Funnel */}
        <CardShell
          title="Lead Conversion Funnel"
          onExport={() => exportCsv('analytics-funnel.csv', data.funnel)}
          exportDisabled={!data.funnel.length}
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : errors['funnel'] ? (
            <ErrorState />
          ) : !data.funnel.length ? (
            <EmptyState />
          ) : (
            <div className="space-y-2 py-1">
              {(() => {
                const topCount = data.funnel[0]?.count ?? 1
                return data.funnel.map(row => {
                  const pct = Math.round((row.count / topCount) * 100)
                  return (
                    <div key={row.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--bb-text-2)' }}>
                          {STAGE_LABELS[row.stage] ?? row.stage}
                        </span>
                        <span style={{ color: 'var(--bb-text-1)' }}>
                          {row.count.toLocaleString()}
                          <span style={{ color: 'var(--bb-text-3)' }}> ({pct}%)</span>
                        </span>
                      </div>
                      <div
                        className="rounded-full overflow-hidden"
                        style={{ height: 6, background: 'var(--bb-surface-3)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: CHART_COLORS[3],
                          }}
                        />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </CardShell>
      </div>

      {/* ── Unanswered Queries ── */}
      <CardShell
        title="Unanswered Queries — Top 10"
        onExport={() => exportCsv('analytics-unanswered.csv', data.unanswered)}
        exportDisabled={!data.unanswered.length}
      >
        {loading ? (
          <Skeleton className="h-40" />
        ) : errors['unanswered'] ? (
          <ErrorState />
        ) : !data.unanswered.length ? (
          <EmptyState message="No unanswered queries this period" />
        ) : (
          <div
            className="rounded-lg overflow-hidden border"
            style={{ borderColor: 'var(--bb-border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bb-surface-2)' }}>
                  <th
                    className="px-4 py-2.5 text-left text-xs font-medium"
                    style={{ color: 'var(--bb-text-3)' }}
                  >
                    Query
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-medium"
                    style={{ color: 'var(--bb-text-3)', width: 100 }}
                  >
                    Frequency
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.unanswered.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: '1px solid var(--bb-border-subtle)',
                    }}
                  >
                    <td
                      className="px-4 py-2.5 text-xs"
                      style={{ color: 'var(--bb-text-2)', maxWidth: 0 }}
                    >
                      <span
                        className="block truncate"
                        title={row.content}
                      >
                        {row.content}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs text-right font-medium tabular-nums"
                      style={{ color: 'var(--bb-text-1)' }}
                    >
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>
    </div>
  )
}
