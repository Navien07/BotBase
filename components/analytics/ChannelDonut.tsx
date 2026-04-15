'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface ChannelBreakdownRow {
  channel: string
  count: number
}

interface ChannelDonutProps {
  data: ChannelBreakdownRow[]
  loading?: boolean
}

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25d366',
  telegram: '#229ed9',
  web:      '#6366f1',
  api:      '#6b7280',
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  web:      'Web',
  api:      'API',
}

function SkeletonDonut() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse flex flex-col gap-3"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <div className="h-4 w-32 rounded" style={{ background: '#242424' }} />
      <div className="h-[200px] rounded-full w-[200px] mx-auto" style={{ background: '#161616' }} />
    </div>
  )
}

export function ChannelDonut({ data, loading }: ChannelDonutProps) {
  if (loading) return <SkeletonDonut />

  const total = data.reduce((sum, row) => sum + row.count, 0)
  const isEmpty = total === 0

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <p className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
        Channel Distribution
      </p>

      {isEmpty ? (
        <div
          className="h-[220px] flex items-center justify-center text-xs"
          style={{ color: '#505050' }}
        >
          No data for this period
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="channel"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  strokeWidth={0}
                >
                  {data.map((row) => (
                    <Cell
                      key={row.channel}
                      fill={CHANNEL_COLORS[row.channel] ?? '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#161616',
                    border: '1px solid #242424',
                    borderRadius: 8,
                    color: '#f0f0f0',
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    typeof value === 'number' ? value.toLocaleString() : String(value ?? ''),
                    CHANNEL_LABELS[String(name ?? '')] ?? String(name ?? ''),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold" style={{ color: '#f0f0f0' }}>
                {total.toLocaleString()}
              </span>
              <span className="text-[10px]" style={{ color: '#505050' }}>total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 flex-1">
            {data.map((row) => {
              const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
              return (
                <div key={row.channel} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: CHANNEL_COLORS[row.channel] ?? '#6b7280' }}
                  />
                  <span className="text-xs flex-1" style={{ color: '#a0a0a0' }}>
                    {CHANNEL_LABELS[row.channel] ?? row.channel}
                  </span>
                  <span className="text-xs font-medium" style={{ color: '#f0f0f0' }}>
                    {row.count.toLocaleString()}
                  </span>
                  <span className="text-xs w-8 text-right" style={{ color: '#505050' }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
