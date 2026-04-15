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

interface VolumeRow {
  date: string
  sent: number
  received: number
}

interface MessageVolumeChartProps {
  channel: 'whatsapp' | 'telegram'
  data: VolumeRow[]
  loading?: boolean
}

const CHANNEL_CONFIG = {
  whatsapp: { label: 'WhatsApp Activity', color: '#25d366' },
  telegram: { label: 'Telegram Activity', color: '#229ed9' },
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

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
      <div className="h-4 w-36 rounded" style={{ background: '#242424' }} />
      <div className="h-[200px] rounded" style={{ background: '#161616' }} />
    </div>
  )
}

export function MessageVolumeChart({ channel, data, loading }: MessageVolumeChartProps) {
  if (loading) return <SkeletonChart />

  const cfg     = CHANNEL_CONFIG[channel]
  const isEmpty = data.length === 0

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <p className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
        {cfg.label}
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
            <Legend wrapperStyle={{ fontSize: 11, color: '#a0a0a0', paddingTop: 8 }} />
            <Bar dataKey="sent"     name="Sent"     fill={cfg.color}                    radius={[2, 2, 0, 0]} />
            <Bar dataKey="received" name="Received" fill={hexToRgba(cfg.color, 0.4)}   radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
