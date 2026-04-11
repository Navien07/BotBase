'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { OperatingHoursRow } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperatingHoursProps {
  botId: string
  initialHours: OperatingHoursRow[]
  onSave: (hours: OperatingHoursRow[]) => void
}

// ─── Day meta ─────────────────────────────────────────────────────────────────

// Display order: Mon–Sun. day_of_week: 0=Sun, 1=Mon … 6=Sat
const DAY_META = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
]

// Build a default row for a day_of_week
function defaultRow(dow: number): OperatingHoursRow {
  return {
    id: '',
    bot_id: '',
    day_of_week: dow,
    is_open: dow >= 1 && dow <= 5, // weekdays open, weekend closed
    open_time: '09:00',
    close_time: '17:00',
    lunch_start: null,
    lunch_end: null,
  }
}

// ─── Time input ───────────────────────────────────────────────────────────────

function TimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="text-sm px-2 py-1 rounded outline-none w-[6.5rem]"
      style={{
        background: disabled ? 'var(--bb-surface-3)' : 'var(--bb-surface)',
        border: '1px solid var(--bb-border)',
        color: disabled ? 'var(--bb-text-3)' : 'var(--bb-text-2)',
        opacity: disabled ? 0.5 : 1,
      }}
    />
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OperatingHours({ botId, initialHours, onSave }: OperatingHoursProps) {
  // Build rows keyed by day_of_week, filling in any missing days
  const [rows, setRows] = useState<OperatingHoursRow[]>(() => {
    return DAY_META.map(({ dow }) => {
      return initialHours.find((r) => r.day_of_week === dow) ?? defaultRow(dow)
    })
  })
  const [saving, setSaving] = useState(false)

  function updateRow(dow: number, patch: Partial<OperatingHoursRow>) {
    setRows((prev) => prev.map((r) => (r.day_of_week === dow ? { ...r, ...patch } : r)))
  }

  function addLunch(dow: number) {
    updateRow(dow, { lunch_start: '12:00', lunch_end: '13:00' })
  }

  function removeLunch(dow: number) {
    updateRow(dow, { lunch_start: null, lunch_end: null })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = DAY_META.map(({ dow }) => {
        const r = rows.find((row) => row.day_of_week === dow)!
        return {
          day_of_week: r.day_of_week,
          is_open: r.is_open,
          open_time: r.open_time || '09:00',
          close_time: r.close_time || '17:00',
          lunch_start: r.lunch_start || null,
          lunch_end: r.lunch_end || null,
        }
      })

      const res = await fetch(`/api/bots/${botId}/operating-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }

      const data = await res.json() as { hours: OperatingHoursRow[] }
      setRows(
        DAY_META.map(({ dow }) => {
          return data.hours.find((r) => r.day_of_week === dow) ?? defaultRow(dow)
        })
      )
      onSave(data.hours)
      toast.success('Operating hours saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {DAY_META.map(({ dow, label }) => {
        const row = rows.find((r) => r.day_of_week === dow) ?? defaultRow(dow)
        const hasLunch = row.lunch_start !== null

        return (
          <div key={dow} className="flex flex-col gap-2">
            {/* Main row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Day label */}
              <span
                className="text-sm font-medium w-24 flex-shrink-0"
                style={{ color: row.is_open ? 'var(--bb-text-1)' : 'var(--bb-text-3)' }}
              >
                {label}
              </span>

              {/* Toggle */}
              <button
                onClick={() => updateRow(dow, { is_open: !row.is_open })}
                className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
                style={{
                  background: row.is_open ? 'rgba(34,197,94,0.15)' : 'var(--bb-surface-3)',
                  color: row.is_open ? '#22c55e' : 'var(--bb-text-3)',
                  border: `1px solid ${row.is_open ? 'rgba(34,197,94,0.3)' : 'var(--bb-border)'}`,
                }}
              >
                {row.is_open ? 'Open' : 'Closed'}
              </button>

              {/* Times */}
              <div className="flex items-center gap-1.5">
                <TimeInput
                  value={row.open_time}
                  onChange={(v) => updateRow(dow, { open_time: v })}
                  disabled={!row.is_open}
                />
                <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>–</span>
                <TimeInput
                  value={row.close_time}
                  onChange={(v) => updateRow(dow, { close_time: v })}
                  disabled={!row.is_open}
                />
              </div>

              {/* Lunch break toggle */}
              {row.is_open && (
                hasLunch ? (
                  <button
                    onClick={() => removeLunch(dow)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--bb-text-3)' }}
                  >
                    <X size={11} /> Remove lunch
                  </button>
                ) : (
                  <button
                    onClick={() => addLunch(dow)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--bb-primary)' }}
                  >
                    <Plus size={11} /> Add lunch break
                  </button>
                )
              )}
            </div>

            {/* Lunch break row */}
            {hasLunch && row.is_open && (
              <div className="flex items-center gap-2 ml-[7.5rem]">
                <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Lunch:</span>
                <TimeInput
                  value={row.lunch_start ?? '12:00'}
                  onChange={(v) => updateRow(dow, { lunch_start: v })}
                />
                <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>–</span>
                <TimeInput
                  value={row.lunch_end ?? '13:00'}
                  onChange={(v) => updateRow(dow, { lunch_end: v })}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Save */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          {saving ? 'Saving…' : 'Save Operating Hours'}
        </button>
      </div>
    </div>
  )
}
