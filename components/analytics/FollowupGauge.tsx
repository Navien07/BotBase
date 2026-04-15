'use client'

interface FollowupRow {
  status: string
  count: number
}

interface FollowupGaugeProps {
  data:     FollowupRow[]
  loading?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: '#22c55e' },
  pending:   { label: 'Pending',   color: '#eab308' },
  failed:    { label: 'Failed',    color: '#ef4444' },
}

const STATUS_ORDER = ['completed', 'pending', 'failed']

function SkeletonGauge() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse flex flex-col gap-3"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <div className="h-4 w-40 rounded" style={{ background: '#242424' }} />
      <div className="h-4 rounded-full" style={{ background: '#161616' }} />
      <div className="flex gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-3 w-20 rounded" style={{ background: '#242424' }} />
        ))}
      </div>
    </div>
  )
}

export function FollowupGauge({ data, loading }: FollowupGaugeProps) {
  if (loading) return <SkeletonGauge />

  const total = data.reduce((sum, r) => sum + r.count, 0)
  const isEmpty = total === 0

  // Build ordered segments
  const segments = STATUS_ORDER.map(s => ({
    status: s,
    count:  data.find(r => r.status === s)?.count ?? 0,
    ...STATUS_CONFIG[s],
  }))

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{ background: '#101010', border: '1px solid #242424' }}
    >
      <p className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
        Follow-up Completion
      </p>

      {isEmpty ? (
        <div className="flex items-center justify-center h-12 text-xs" style={{ color: '#505050' }}>
          No follow-up data for this period
        </div>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="h-4 rounded-full overflow-hidden flex" style={{ background: '#242424' }}>
            {segments.map(seg => {
              const pct = total > 0 ? (seg.count / total) * 100 : 0
              if (pct === 0) return null
              return (
                <div
                  key={seg.status}
                  style={{ width: `${pct}%`, background: seg.color }}
                  title={`${seg.label}: ${seg.count}`}
                />
              )
            })}
          </div>

          {/* Legend with counts */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {segments.map(seg => {
              const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0
              return (
                <div key={seg.status} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: seg.color }}
                  />
                  <span className="text-xs" style={{ color: '#a0a0a0' }}>
                    {seg.label}
                  </span>
                  <span className="text-xs font-medium" style={{ color: '#f0f0f0' }}>
                    {pct}%
                  </span>
                  <span className="text-xs" style={{ color: '#505050' }}>
                    ({seg.count.toLocaleString()})
                  </span>
                </div>
              )
            })}
          </div>

          {/* Total line */}
          <p className="text-xs" style={{ color: '#505050' }}>
            {total.toLocaleString()} total follow-ups tracked
          </p>
        </>
      )}
    </div>
  )
}
