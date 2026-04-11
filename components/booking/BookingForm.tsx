'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { Booking, Service } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingFormProps {
  botId: string
  services: Service[]
  bookingType?: 'appointment' | 'table' | 'property_viewing'
  onSuccess: (booking: Booking) => void
  onClose: () => void
}

interface FormState {
  customer_name: string
  customer_phone: string
  customer_email: string
  service_id: string
  date: string
  time: string
  party_size: number
  special_requests: string
  notes: string
  is_walk_in: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t)
}

function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  error,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>
        {label}
        {required && <span style={{ color: 'var(--bb-danger)' }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs" style={{ color: 'var(--bb-danger)' }}>{error}</p>
      )}
    </div>
  )
}

const inputStyle = {
  background: 'var(--bb-surface-2)',
  border: '1px solid var(--bb-border)',
  color: 'var(--bb-text-1)',
  borderRadius: '6px',
  padding: '0.5rem 0.625rem',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
} as const

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingForm({ botId, services, bookingType = 'appointment', onSuccess, onClose }: BookingFormProps) {
  const [form, setForm] = useState<FormState>({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    service_id: '',
    date: todayString(),
    time: '',
    party_size: 1,
    special_requests: '',
    notes: '',
    is_walk_in: false,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.customer_name.trim()) errs.customer_name = 'Required'
    if (!form.customer_phone.trim()) errs.customer_phone = 'Required'
    if (!form.date) errs.date = 'Required'
    if (!form.time) {
      errs.time = 'Required'
    } else if (!isValidTime(form.time)) {
      errs.time = 'Format must be HH:MM'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const startTime = new Date(`${form.date}T${form.time}:00`).toISOString()

      const selectedService = services.find((s) => s.id === form.service_id)
      const body: Record<string, unknown> = {
        booking_type: bookingType,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        start_time: startTime,
        party_size: form.party_size,
      }

      if (form.customer_email.trim()) body.customer_email = form.customer_email.trim()
      if (form.service_id) body.service_id = form.service_id
      if (selectedService) body.service_name = selectedService.name
      if (form.special_requests.trim()) body.special_requests = form.special_requests.trim()
      if (form.notes.trim()) body.staff_notes = form.notes.trim()

      const res = await fetch(`/api/bookings/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Failed to create booking')
      }

      const data = await res.json() as { booking: Booking }
      toast.success('Booking created successfully')
      onSuccess(data.booking)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  const isTable = bookingType === 'table'

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md h-full overflow-y-auto flex flex-col"
        style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            New Booking
          </h2>
          <button onClick={onClose} style={{ color: 'var(--bb-text-3)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 flex-1">
          {/* Customer name */}
          <Field label="Customer name" required error={errors.customer_name}>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => set('customer_name', e.target.value)}
              placeholder="Full name"
              style={inputStyle}
            />
          </Field>

          {/* Customer phone */}
          <Field label="Phone number" required error={errors.customer_phone}>
            <input
              type="tel"
              value={form.customer_phone}
              onChange={(e) => set('customer_phone', e.target.value)}
              placeholder="+60 12 345 6789"
              style={inputStyle}
            />
          </Field>

          {/* Customer email */}
          <Field label="Email (optional)" error={errors.customer_email}>
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => set('customer_email', e.target.value)}
              placeholder="email@example.com"
              style={inputStyle}
            />
          </Field>

          {/* Service selector — only for appointment + property */}
          {!isTable && services.length > 0 && (
            <Field label="Service">
              <select
                value={form.service_id}
                onChange={(e) => set('service_id', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Select a service</option>
                {services.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.duration_minutes ? ` (${s.duration_minutes} min)` : ''}
                    {s.price != null ? ` — ${s.currency} ${s.price}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required error={errors.date}>
              <input
                type="date"
                value={form.date}
                min={todayString()}
                onChange={(e) => set('date', e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Time (HH:MM)" required error={errors.time}>
              <input
                type="time"
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
                placeholder="14:00"
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Party size — table only */}
          {isTable && (
            <Field label="Party size" error={errors.party_size}>
              <input
                type="number"
                value={form.party_size}
                min={1}
                max={50}
                onChange={(e) => set('party_size', parseInt(e.target.value, 10) || 1)}
                style={inputStyle}
              />
            </Field>
          )}

          {/* Special requests */}
          <Field label="Special requests">
            <textarea
              value={form.special_requests}
              onChange={(e) => set('special_requests', e.target.value)}
              rows={3}
              placeholder="Dietary requirements, accessibility needs…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {/* Staff notes */}
          <Field label="Notes (internal)">
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Internal notes (not shared with customer)"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {/* Walk-in */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_walk_in}
              onChange={(e) => set('is_walk_in', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>
                Walk-in
              </p>
              <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                Mark as walk-in — no confirmation sent
              </p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-2 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm py-2 rounded font-medium"
              style={{
                background: 'var(--bb-surface-2)',
                border: '1px solid var(--bb-border)',
                color: 'var(--bb-text-2)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 text-sm py-2 rounded font-medium disabled:opacity-50"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {submitting ? 'Creating…' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
