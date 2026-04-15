'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Trend = 'up' | 'down' | 'neutral'

interface KPICardProps {
  label: string
  value: number | string | undefined
  delta?: number
  trend?: Trend
  sparkline?: number[]
  icon: React.ReactNode
  format?: 'number' | 'percent' | 'currency'
  highlightColor?: string
}

function formatValue(value: number | string, format?: KPICardProps['format']): string {
  if (typeof value === 'string') return value
  if (format === 'percent') return `${value.toLocaleString()}%`
  if (format === 'currency') return `$${value.toLocaleString()}`
  return value.toLocaleString()
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const barWidth = 6
  const gap = 2
  const height = 24
  const totalWidth = data.length * (barWidth + gap) - gap

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      aria-hidden="true"
    >
      {data.map((val, i) => {
        const barHeight = Math.max(2, Math.round((val / max) * height))
        const x = i * (barWidth + gap)
        const y = height - barHeight
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={color}
            opacity={0.4}
            rx={1}
          />
        )
      })}
    </svg>
  )
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 animate-pulse"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded" style={{ background: '#242424' }} />
        <div className="h-3 w-24 rounded" style={{ background: '#242424' }} />
      </div>
      <div className="h-7 w-20 rounded" style={{ background: '#242424' }} />
      <div className="h-3 w-16 rounded" style={{ background: '#242424' }} />
    </div>
  )
}

export function KPICard({
  label,
  value,
  delta = 0,
  trend = 'neutral',
  sparkline,
  icon,
  format,
  highlightColor = '#6366f1',
}: KPICardProps) {
  if (value === undefined) return <SkeletonCard />

  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#505050'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const deltaDisplay = trend === 'neutral' ? '—' : `${delta > 0 ? '+' : ''}${delta}%`

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ color: '#a0a0a0' }}>
        <span className="w-4 h-4 shrink-0">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide truncate">{label}</span>
      </div>

      {/* Value + delta row */}
      <div className="flex items-end justify-between gap-2">
        <span
          className="text-[28px] font-bold leading-none"
          style={{ color: '#f0f0f0' }}
        >
          {formatValue(value, format)}
        </span>

        <div className="flex items-center gap-1 pb-1" style={{ color: trendColor }}>
          <TrendIcon size={13} />
          <span className="text-xs font-medium">{deltaDisplay}</span>
        </div>
      </div>

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-1">
          <Sparkline data={sparkline} color={highlightColor} />
        </div>
      )}
    </div>
  )
}
