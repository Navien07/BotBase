'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface ConversationRow {
  date: string
  whatsapp: number
  telegram: number
  web: number
  api: number
}

interface ConversationChartProps {
  data: ConversationRow[]
  loading?: boolean
}

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', color: '#25d366' },
  { key: 'telegram', label: 'Telegram', color: '#229ed9' },
  { key: 'web',      label: 'Web',      color: '#6366f1' },
  { key: 'api',      label: 'API',      color: '#6b7280' },
] as const

function formatDate(dateStr: unknown) {
  try {
    return format(parseISO(String(dateStr ?? '')), 'MMM d')
  } catch {
    return String(dateStr ?? '')
  }
}

function SkeletonChart() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse flex flex-col gap-3"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <div className="h-4 w-40 rounded" style={{ background: '#242424' }} />
      <div className="h-[200px] rounded" style={{ background: '#161616' }} />
    </div>
  )
}

export function ConversationChart({ data, loading }: ConversationChartProps) {
  if (loading) return <SkeletonChart />

  const isEmpty = data.length === 0

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <p className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
        Conversations by Channel
      </p>

      {isEmpty ? (
        <div
          className="h-[220px] flex items-center justify-center text-xs"
          style={{ color: '#505050' }}
        >
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#242424" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: '#505050', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#505050', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#161616',
                border: '1px solid #242424',
                borderRadius: 8,
                color: '#f0f0f0',
                fontSize: 12,
              }}
              labelFormatter={formatDate}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#a0a0a0', paddingTop: 8 }}
            />
            {CHANNELS.map((ch) => (
              <Bar key={ch.key} dataKey={ch.key} name={ch.label} fill={ch.color} stackId="a" radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
