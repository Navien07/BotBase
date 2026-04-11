'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import type { BookingStatus } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarBooking {
  id: string
  start_time: string
  status: BookingStatus
  customer_name: string | null
  services?: { name: string } | null
  service_name?: string | null
}

interface BookingCalendarProps {
  botId: string
  bookings: CalendarBooking[]
}

// ─── Dot colors ───────────────────────────────────────────────────────────────

const DOT_COLOR: Record<string, string> = {
  confirmed: '#22c55e',
  pending:   '#f59e0b',
  reminded:  '#22d3ee',
  completed: '#6366f1',
  cancelled: '#ef4444',
  no_show:   '#ef4444',
  walk_in:   '#22d3ee',
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  pending:   'Pending',
  reminded:  'Reminded',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show:   'No-show',
  walk_in:   'Walk-in',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingCalendar({ bookings }: BookingCalendarProps) {
  const [current, setCurrent] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(null)

  const today = new Date()
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)

  // Build grid rows
  const weeks: Date[][] = []
  let day = calStart
  while (day <= calEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
  }

  function bookingsForDay(d: Date) {
    return bookings.filter((b) => isSameDay(new Date(b.start_time), d))
  }

  const selectedBookings = selected ? bookingsForDay(selected) : []

  return (
    <div className="flex flex-col gap-0">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrent((c) => subMonths(c, 1))}
          className="p-1.5 rounded"
          style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
          {format(current, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrent((c) => addMonths(c, 1))}
          className="p-1.5 rounded"
          style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Calendar grid */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--bb-border)' }}
      >
        {/* Day headers */}
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bb-surface-2)', borderBottom: '1px solid var(--bb-border)' }}
        >
          {DAYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-medium"
              style={{ color: 'var(--bb-text-3)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid"
            style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderTop: wi === 0 ? 'none' : '1px solid var(--bb-border-subtle)' }}
          >
            {week.map((d, di) => {
              const isThisMonth = isSameMonth(d, current)
              const isToday = isSameDay(d, today)
              const isSelected = selected ? isSameDay(d, selected) : false
              const dayBookings = bookingsForDay(d)

              return (
                <button
                  key={di}
                  onClick={() => setSelected(isSelected ? null : d)}
                  className="flex flex-col gap-1 p-2 min-h-[72px] text-left transition-colors"
                  style={{
                    borderLeft: di === 0 ? 'none' : '1px solid var(--bb-border-subtle)',
                    background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                    outline: isToday ? '2px solid var(--bb-primary)' : 'none',
                    outlineOffset: '-2px',
                    borderRadius: isToday ? '4px' : '0',
                  }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: isToday
                        ? 'var(--bb-primary)'
                        : isThisMonth
                        ? 'var(--bb-text-2)'
                        : 'var(--bb-text-3)',
                      opacity: isThisMonth ? 1 : 0.4,
                    }}
                  >
                    {format(d, 'd')}
                  </span>

                  {/* Booking dots */}
                  {dayBookings.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {dayBookings.slice(0, 5).map((b) => (
                        <span
                          key={b.id}
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: DOT_COLOR[b.status] ?? '#6b7280' }}
                        />
                      ))}
                      {dayBookings.length > 5 && (
                        <span className="text-[10px]" style={{ color: 'var(--bb-text-3)' }}>
                          +{dayBookings.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Day detail panel */}
      {selected && (
        <div
          className="mt-3 rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--bb-border)', background: 'var(--bb-surface-2)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--bb-border)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
              {format(selected, 'EEEE, d MMMM yyyy')}
            </span>
            <button onClick={() => setSelected(null)} style={{ color: 'var(--bb-text-3)' }}>
              <X size={14} />
            </button>
          </div>

          {selectedBookings.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--bb-text-3)' }}>
              No bookings on this day
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--bb-border-subtle)' }}>
              {selectedBookings.map((b) => {
                const dotColor = DOT_COLOR[b.status] ?? '#6b7280'
                const serviceName = b.services?.name ?? b.service_name
                return (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: dotColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
                        {b.customer_name ?? 'Unknown'}
                      </p>
                      {serviceName && (
                        <p className="text-xs truncate" style={{ color: 'var(--bb-text-3)' }}>
                          {serviceName}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                        {format(new Date(b.start_time), 'h:mm a')}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${dotColor}22`, color: dotColor }}
                      >
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
