'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface LeadStageRow {
  stage: string
  count: number
}

interface BookingStatusRow {
  status: string
  count: number
}

interface BookingFunnelProps {
  leadStages:     LeadStageRow[]
  bookingStatus:  BookingStatusRow[]
  loading?:       boolean
}

const STAGE_ORDER = ['visitor', 'lead', 'qualified', 'booked', 'closed']
const STAGE_LABELS: Record<string, string> = {
  visitor:   'Visitor',
  lead:      'Lead',
  qualified: 'Qualified',
  booked:    'Booked',
  closed:    'Closed',
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#22c55e',
  pending:   '#eab308',
  cancelled: '#ef4444',
  'no-show': '#6b7280',
}
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  pending:   'Pending',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
}

function FunnelBar({ label, count, maxCount, pct }: {
  label: string; count: number; maxCount: number; pct: number | null
}) {
  const width = maxCount > 0 ? Math.max(8, Math.round((count / maxCount) * 100)) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: '#a0a0a0' }}>{label}</span>
        <div className="flex items-center gap-2">
          {pct !== null && (
            <span style={{ color: '#505050' }}>{pct}%</span>
          )}
          <span className="font-medium" style={{ color: '#f0f0f0' }}>
            {count.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#242424' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: '#6366f1' }}
        />
      </div>
    </div>
  )
}

function SkeletonFunnel() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse flex flex-col gap-4"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <div className="h-4 w-32 rounded" style={{ background: '#242424' }} />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            {[...Array(4)].map((__, j) => (
              <div key={j} className="h-6 rounded" style={{ background: '#161616' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function BookingFunnel({ leadStages, bookingStatus, loading }: BookingFunnelProps) {
  if (loading) return <SkeletonFunnel />

  // Sort lead stages by canonical order
  const sortedLeads = STAGE_ORDER.map(s => ({
    stage: s,
    count: leadStages.find(r => r.stage === s)?.count ?? 0,
  })).filter(r => r.count > 0 || STAGE_ORDER.indexOf(r.stage) === 0)

  const maxLeadCount = sortedLeads[0]?.count ?? 0
  const totalBookings = bookingStatus.reduce((s, r) => s + r.count, 0)

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <p className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
        Lead & Booking Funnel
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: Lead funnel bars */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#505050' }}>
            Lead Conversion
          </p>
          {sortedLeads.map((row, i) => {
            const prevCount = i > 0 ? sortedLeads[i - 1].count : null
            const dropPct = prevCount && prevCount > 0
              ? Math.round((row.count / prevCount) * 100)
              : null
            return (
              <FunnelBar
                key={row.stage}
                label={STAGE_LABELS[row.stage] ?? row.stage}
                count={row.count}
                maxCount={maxLeadCount}
                pct={dropPct}
              />
            )
          })}
          {sortedLeads.length === 0 && (
            <p className="text-xs" style={{ color: '#505050' }}>No lead data for this period</p>
          )}
        </div>

        {/* Right: Booking status donut */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#505050' }}>
            Booking Status
          </p>
          {totalBookings === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-xs" style={{ color: '#505050' }}>
              No bookings for this period
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bookingStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={54}
                      strokeWidth={0}
                    >
                      {bookingStatus.map((row) => (
                        <Cell key={row.status} fill={STATUS_COLORS[row.status] ?? '#6b7280'} />
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
                        STATUS_LABELS[String(name ?? '')] ?? String(name ?? ''),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-bold" style={{ color: '#f0f0f0' }}>
                    {totalBookings.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                {bookingStatus.map(row => {
                  const pct = Math.round((row.count / totalBookings) * 100)
                  return (
                    <div key={row.status} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ background: STATUS_COLORS[row.status] ?? '#6b7280' }}
                      />
                      <span className="text-xs flex-1" style={{ color: '#a0a0a0' }}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                      <span className="text-xs" style={{ color: '#f0f0f0' }}>
                        {row.count}
                      </span>
                      <span className="text-xs w-7 text-right" style={{ color: '#505050' }}>
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
