'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { ELKEN_BOT_ID } from '@/lib/tenants/elken/config'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  getSortedRowModel,
} from '@tanstack/react-table'
import {
  Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  ChevronsUpDown, CalendarDays, List, Check, X, Clock,
  MapPin, Phone, User, Calendar, Settings, Briefcase,
  ToggleLeft, ToggleRight, Edit2, Trash2, AlertCircle,
  Loader2, RefreshCw,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import type { Booking, Service, BookingStatus, OperatingHoursRow } from '@/types/database'
import { BookingCalendar } from '@/components/booking/BookingCalendar'
import { BookingForm } from '@/components/booking/BookingForm'
import { OperatingHours } from '@/components/booking/OperatingHours'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  pending:       { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b', label: 'Pending' },
  trial_pending: { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', label: 'Trial' },
  confirmed:     { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e', label: 'Confirmed' },
  reminded:      { bg: 'rgba(34,211,238,0.15)',  text: '#22d3ee', label: 'Reminded' },
  completed:     { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8', label: 'Completed' },
  no_show:       { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444', label: 'No-show' },
  cancelled:     { bg: 'rgba(100,100,100,0.15)', text: '#6b7280', label: 'Cancelled' },
  walk_in:       { bg: 'rgba(34,211,238,0.1)',   text: '#22d3ee', label: 'Walk-in' },
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const { bg, text, label } = STATUS_STYLES[status] ?? { bg: 'transparent', text: 'inherit', label: status }
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  )
}

function formatDateTime(iso: string) {
  try {
    return format(new Date(iso), 'dd MMM yyyy, h:mm a')
  } catch {
    return iso
  }
}

// ─── Booking Detail Sheet ──────────────────────────────────────────────────────

interface BookingDetailSheetProps {
  booking: Booking
  botId: string
  onClose: () => void
  onUpdated: (b: Booking) => void
}

function BookingDetailSheet({ booking, botId, onClose, onUpdated }: BookingDetailSheetProps) {
  const [busy, setBusy] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)

  async function handleAction(action: 'confirm' | 'cancel' | 'no-show', reason?: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${botId}/${booking.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      onUpdated(data.booking as Booking)
      toast.success(`Booking ${action === 'no-show' ? 'marked as no-show' : action + 'ed'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const auditLog = Array.isArray(booking.audit_log) ? booking.audit_log : []

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
          className="flex items-center justify-between p-4 sticky top-0 z-10"
          style={{ background: 'var(--bb-surface)', borderBottom: '1px solid var(--bb-border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
              {booking.customer_name ?? 'Unknown Customer'}
            </p>
            <StatusBadge status={booking.status} />
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5">
            <X size={16} style={{ color: 'var(--bb-text-3)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4 flex-1">
          {/* Service + time */}
          <div
            className="rounded-lg p-3 flex flex-col gap-2"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
          >
            {booking.service_name && (
              <div className="flex items-center gap-2">
                <Briefcase size={13} style={{ color: 'var(--bb-text-3)', flexShrink: 0 }} />
                <span className="text-sm" style={{ color: 'var(--bb-text-1)' }}>{booking.service_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar size={13} style={{ color: 'var(--bb-text-3)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
                {formatDateTime(booking.start_time)}
              </span>
            </div>
            {booking.location && (
              <div className="flex items-center gap-2">
                <MapPin size={13} style={{ color: 'var(--bb-text-3)', flexShrink: 0 }} />
                <span className="text-sm" style={{ color: 'var(--bb-text-2)' }}>{booking.location}</span>
              </div>
            )}
          </div>

          {/* Customer info */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--bb-text-3)' }}>Customer</p>
            {booking.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone size={13} style={{ color: 'var(--bb-text-3)' }} />
                <span className="text-sm" style={{ color: 'var(--bb-text-2)' }}>{booking.customer_phone}</span>
              </div>
            )}
            {booking.special_requests && (
              <div className="flex items-start gap-2 mt-1">
                <AlertCircle size={13} style={{ color: 'var(--bb-text-3)', flexShrink: 0, marginTop: 2 }} />
                <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>{booking.special_requests}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <div className="flex gap-2 flex-wrap">
              {booking.status !== 'confirmed' && (
                <button
                  disabled={busy}
                  onClick={() => handleAction('confirm')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50"
                  style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                >
                  <Check size={12} /> Confirm
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => handleAction('no-show')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <Clock size={12} /> No-show
              </button>
              <button
                disabled={busy}
                onClick={() => handleAction('cancel')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50"
                style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)', border: '1px solid var(--bb-border)' }}
              >
                <X size={12} /> Cancel
              </button>
            </div>
          )}

          {/* Audit log accordion */}
          {auditLog.length > 0 && (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--bb-border)' }}
            >
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium"
                style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
                onClick={() => setAuditOpen((v) => !v)}
              >
                <span>Audit Log ({auditLog.length})</span>
                {auditOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {auditOpen && (
                <div className="flex flex-col divide-y" style={{ borderColor: 'var(--bb-border-subtle)' }}>
                  {(auditLog as Array<{ action: string; timestamp: string; note?: string | null }>).map((entry, i) => (
                    <div key={i} className="px-3 py-2 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium capitalize" style={{ color: 'var(--bb-text-2)' }}>
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>{entry.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Booking row type (with joined service) ───────────────────────────────────

type BookingRow = Booking & { services?: { name: string } | null }

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({
  botId,
  sheetOpen,
  setSheetOpen,
}: {
  botId: string
  sheetOpen: boolean
  setSheetOpen: (open: boolean) => void
}) {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [services, setServices] = useState<Service[]>([])
  const [selected, setSelected] = useState<BookingRow | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const limit = 20
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (statusFilter) sp.set('status', statusFilter)
      if (dateFrom) sp.set('date_from', dateFrom)
      if (dateTo) sp.set('date_to', dateTo)
      const res = await fetch(`/api/bookings/${botId}?${sp}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setBookings(data.bookings)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [botId, page, statusFilter, dateFrom, dateTo])

  useEffect(() => { fetchBookings() }, [fetchBookings])
  useEffect(() => { setPage(1) }, [statusFilter, dateFrom, dateTo])

  useEffect(() => {
    fetch(`/api/bots/${botId}/services`)
      .then((r) => r.json())
      .then((d: { services?: Service[] }) => setServices(d.services ?? []))
      .catch(() => {})
  }, [botId])

  function handleNewBooking(booking: Booking) {
    setSheetOpen(false)
    setBookings((prev) => [booking as BookingRow, ...prev])
    setTotal((t) => t + 1)
  }

  function handleUpdated(updated: Booking) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)))
    if (selected?.id === updated.id) setSelected({ ...selected, ...updated })
  }

  const colHelper = createColumnHelper<BookingRow>()
  const columns = [
    colHelper.accessor('customer_name', {
      header: 'Customer',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            {(info.getValue() ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <span className="text-sm" style={{ color: 'var(--bb-text-1)' }}>
            {info.getValue() ?? 'Unknown'}
          </span>
        </div>
      ),
    }),
    colHelper.display({
      id: 'service_name',
      header: 'Service',
      cell: (info) => {
        const b = info.row.original
        const name = b.services?.name ?? b.service_name
        return <span className="text-sm" style={{ color: 'var(--bb-text-2)' }}>{name ?? '—'}</span>
      },
    }),
    colHelper.accessor('start_time', {
      header: 'Date & Time',
      cell: (info) => (
        <span className="text-sm whitespace-nowrap" style={{ color: 'var(--bb-text-2)' }}>
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
    colHelper.accessor('location', {
      header: 'Location',
      enableSorting: false,
      cell: (info) => (
        <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>
          {info.getValue() ?? '—'}
        </span>
      ),
    }),
    colHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    colHelper.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: (info) => {
        const b = info.row.original
        if (b.status === 'cancelled' || b.status === 'completed') return null
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {b.status !== 'confirmed' && (
              <button
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/bookings/${botId}/${b.id}/confirm`, { method: 'POST' })
                    if (!res.ok) throw new Error((await res.json()).error)
                    const data = await res.json()
                    handleUpdated(data.booking)
                    toast.success('Confirmed')
                  } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
                }}
              >
                Confirm
              </button>
            )}
            <button
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/bookings/${botId}/${b.id}/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  })
                  if (!res.ok) throw new Error((await res.json()).error)
                  const data = await res.json()
                  handleUpdated(data.booking)
                  toast.success('Cancelled')
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
              }}
            >
              Cancel
            </button>
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: bookings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  })

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          className="text-sm px-2 py-1.5 rounded outline-none"
          style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_STYLES) as BookingStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--bb-text-3)' }}>From</label>
          <input
            type="date"
            className="text-sm px-2 py-1.5 rounded outline-none"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--bb-text-3)' }}>To</label>
          <input
            type="date"
            className="text-sm px-2 py-1.5 rounded outline-none"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(statusFilter || dateFrom || dateTo) && (
          <button
            className="text-xs"
            style={{ color: 'var(--bb-text-3)' }}
            onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo('') }}
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* View toggle — calendar is a placeholder per Plan 08-03 */}
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--bb-border)' }}>
            {([['list', 'List', <List key="l" size={13} />], ['calendar', 'Calendar', <CalendarDays key="c" size={13} />]] as const).map(
              ([v, label, icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v as 'list' | 'calendar')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  style={{
                    background: view === v ? 'var(--bb-primary)' : 'var(--bb-surface-2)',
                    color: view === v ? '#fff' : 'var(--bb-text-3)',
                  }}
                >
                  {icon}{label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <BookingCalendar botId={botId} bookings={bookings} />
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--bb-border)' }}>
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    style={{ background: 'var(--bb-surface-2)', borderBottom: '1px solid var(--bb-border)' }}
                  >
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-medium"
                        style={{ color: 'var(--bb-text-3)', whiteSpace: 'nowrap' }}
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            className="flex items-center gap-1"
                            onClick={header.column.getToggleSortingHandler()}
                            disabled={!header.column.getCanSort()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              header.column.getIsSorted() === 'asc' ? <ChevronUp size={11} /> :
                              header.column.getIsSorted() === 'desc' ? <ChevronDown size={11} /> :
                              <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--bb-text-3)' }}>
                      Loading bookings…
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <CalendarDays size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--bb-text-3)' }} />
                      <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>No bookings found</p>
                      {(statusFilter || dateFrom || dateTo) && (
                        <p className="text-xs mt-1" style={{ color: 'var(--bb-text-3)' }}>Try adjusting your filters</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-white/[0.02] cursor-pointer"
                      style={{ borderTop: '1px solid var(--bb-border-subtle)' }}
                      onClick={() => setSelected(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                Page {page} of {totalPages} · {total} bookings
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded disabled:opacity-30"
                  style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded disabled:opacity-30"
                  style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* New Booking sheet */}
      {sheetOpen && (
        <BookingForm
          botId={botId}
          services={services}
          onSuccess={handleNewBooking}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* Detail sheet */}
      {selected && (
        <BookingDetailSheet
          booking={selected}
          botId={botId}
          onClose={() => setSelected(null)}
          onUpdated={(b) => { handleUpdated(b); setSelected({ ...selected, ...b }) }}
        />
      )}
    </div>
  )
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

interface ServiceFormState {
  name: string
  description: string
  duration_minutes: number
  buffer_minutes: number
  max_simultaneous: number
  price: string
  currency: string
  is_active: boolean
}

const EMPTY_SERVICE: ServiceFormState = {
  name: '',
  description: '',
  duration_minutes: 60,
  buffer_minutes: 0,
  max_simultaneous: 1,
  price: '',
  currency: 'MYR',
  is_active: true,
}

function ServicesTab({ botId }: { botId: string }) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState<ServiceFormState>(EMPTY_SERVICE)
  const [saving, setSaving] = useState(false)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bots/${botId}/services?all=true`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setServices(data.services)
    } catch {
      toast.error('Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { fetchServices() }, [fetchServices])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_SERVICE)
    setShowForm(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      name: s.name,
      description: s.description ?? '',
      duration_minutes: s.duration_minutes,
      buffer_minutes: s.buffer_minutes,
      max_simultaneous: s.max_simultaneous,
      price: s.price != null ? String(s.price) : '',
      currency: s.currency,
      is_active: s.is_active,
    })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        duration_minutes: form.duration_minutes,
        buffer_minutes: form.buffer_minutes,
        max_simultaneous: form.max_simultaneous,
        price: form.price ? Number(form.price) : undefined,
        currency: form.currency,
        is_active: form.is_active,
      }

      if (editing) {
        const res = await fetch(`/api/bots/${botId}/services/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Service updated')
      } else {
        const res = await fetch(`/api/bots/${botId}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Service added')
      }

      setShowForm(false)
      fetchServices()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(s: Service) {
    try {
      const res = await fetch(`/api/bots/${botId}/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setServices((prev) => prev.map((sv) => sv.id === s.id ? { ...sv, is_active: !sv.is_active } : sv))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  async function handleDelete(s: Service) {
    if (!confirm(`Remove "${s.name}"? This will soft-delete it.`)) return
    try {
      const res = await fetch(`/api/bots/${botId}/services/${s.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Service removed')
      fetchServices()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          {services.filter((s) => s.is_active).length} active service{services.filter((s) => s.is_active).length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded font-medium"
          style={{ background: 'var(--bb-primary)', color: '#fff' }}
        >
          <Plus size={14} /> Add Service
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--bb-text-3)' }}>Loading services…</p>
      ) : services.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--bb-text-3)' }} />
          <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>No services yet</p>
          <button onClick={openAdd} className="text-xs mt-2" style={{ color: 'var(--bb-primary)' }}>
            Add your first service
          </button>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--bb-border)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bb-surface-2)', borderBottom: '1px solid var(--bb-border)' }}>
                {['Name', 'Duration', 'Buffer', 'Simultaneous', 'Price', 'Active', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--bb-text-3)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--bb-border-subtle)' }}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>{s.name}</p>
                      {s.description && (
                        <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--bb-text-3)' }}>
                          {s.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--bb-text-2)' }}>
                    {s.duration_minutes} min
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--bb-text-2)' }}>
                    {s.buffer_minutes} min
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--bb-text-2)' }}>
                    {s.max_simultaneous}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--bb-text-2)' }}>
                    {s.price != null ? `${s.currency} ${Number(s.price).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(s)}>
                      {s.is_active
                        ? <ToggleRight size={20} style={{ color: 'var(--bb-primary)' }} />
                        : <ToggleLeft size={20} style={{ color: 'var(--bb-text-3)' }} />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded hover:bg-white/5"
                        title="Edit"
                      >
                        <Edit2 size={13} style={{ color: 'var(--bb-text-3)' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-1.5 rounded hover:bg-white/5"
                        title="Delete"
                      >
                        <Trash2 size={13} style={{ color: 'var(--bb-danger)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline add/edit service sheet */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="relative w-full max-w-md h-full overflow-y-auto flex flex-col"
            style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4 sticky top-0 z-10"
              style={{ background: 'var(--bb-surface)', borderBottom: '1px solid var(--bb-border)' }}
            >
              <p className="font-semibold text-sm" style={{ color: 'var(--bb-text-1)' }}>
                {editing ? 'Edit Service' : 'Add Service'}
              </p>
              <button onClick={() => setShowForm(false)}>
                <X size={16} style={{ color: 'var(--bb-text-3)' }} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4 flex-1">
              {([
                { key: 'name', label: 'Name *', type: 'text', placeholder: 'e.g. Hair Cut' },
                { key: 'description', label: 'Description', type: 'text', placeholder: 'Optional' },
                { key: 'duration_minutes', label: 'Duration (min)', type: 'number', placeholder: '60' },
                { key: 'buffer_minutes', label: 'Buffer (min)', type: 'number', placeholder: '0' },
                { key: 'max_simultaneous', label: 'Max simultaneous', type: 'number', placeholder: '1' },
                { key: 'price', label: 'Price (optional)', type: 'number', placeholder: '0.00' },
                { key: 'currency', label: 'Currency', type: 'text', placeholder: 'MYR' },
              ] as const).map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--bb-text-2)' }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded outline-none"
                    style={{
                      background: 'var(--bb-surface-2)',
                      border: '1px solid var(--bb-border)',
                      color: 'var(--bb-text-1)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              className="p-4 flex gap-2 sticky bottom-0"
              style={{ background: 'var(--bb-surface)', borderTop: '1px solid var(--bb-border)' }}
            >
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 text-sm py-2 rounded"
                style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 text-sm py-2 rounded font-medium disabled:opacity-50"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Google Calendar Resource Map ─────────────────────────────────────────────

const ELKEN_RESOURCE_MAP = [
  { key: 'bed_female_okr',    label: 'Female Bed',   location: 'OKR'    },
  { key: 'bed_male_okr',      label: 'Male Bed',     location: 'OKR'    },
  { key: 'room_small_okr',    label: 'Meeting Room', location: 'OKR'    },
  { key: 'room_large_okr',    label: 'Meeting Hall', location: 'OKR'    },
  { key: 'inhaler_okr',       label: 'Inhaler',      location: 'OKR'    },
  { key: 'bed_female_subang', label: 'Female Bed',   location: 'Subang' },
  { key: 'bed_male_subang',   label: 'Male Bed',     location: 'Subang' },
  { key: 'inhaler_subang',    label: 'Inhaler',      location: 'Subang' },
] as const

type ResourceKey = typeof ELKEN_RESOURCE_MAP[number]['key']

function ResourceMapRow({
  botId,
  resourceKey,
  label,
  location,
  calendarList,
  currentCalendarId,
  isDuplicate,
  onChange,
  onCalendarCreated,
}: {
  botId: string
  resourceKey: ResourceKey
  label: string
  location: string
  calendarList: { id: string; summary: string }[]
  currentCalendarId: string
  isDuplicate: boolean
  onChange: (calendarId: string) => void
  onCalendarCreated: (newCal: { id: string; summary: string }) => void
}) {
  const [creating, setCreating] = useState(false)

  async function handleNewCalendar() {
    setCreating(true)
    try {
      const name = `IceBot — ${label} ${location}`
      const res = await fetch(`/api/bots/${botId}/google-calendar/calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to create calendar')
      }
      const data = await res.json() as { id: string; summary: string }
      onCalendarCreated({ id: data.id, summary: data.summary })
      onChange(data.id)
      toast.success(`Created "${data.summary}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create calendar')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="flex items-center gap-2 py-2"
      style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm" style={{ color: 'var(--bb-text-1)' }}>{label}</span>
        <span className="text-xs ml-2" style={{ color: 'var(--bb-text-3)' }}>{location}</span>
        {isDuplicate && (
          <span
            className="ml-2 text-xs"
            style={{ color: 'var(--bb-warning)' }}
            title="Same calendar assigned to another resource"
          >
            ⚠
          </span>
        )}
      </div>
      <select
        value={currentCalendarId}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-2 py-1.5 rounded outline-none"
        style={{
          background: 'var(--bb-surface-3)',
          border: '1px solid var(--bb-border)',
          color: currentCalendarId ? 'var(--bb-text-1)' : 'var(--bb-text-3)',
          maxWidth: '200px',
        }}
      >
        <option value="">Primary calendar</option>
        {calendarList.map((c) => (
          <option key={c.id} value={c.id}>{c.summary}</option>
        ))}
      </select>
      <button
        onClick={handleNewCalendar}
        disabled={creating}
        className="flex items-center gap-1 text-xs px-2 py-1.5 rounded flex-shrink-0"
        style={{
          background: 'var(--bb-surface-3)',
          border: '1px solid var(--bb-border)',
          color: creating ? 'var(--bb-text-3)' : 'var(--bb-primary)',
          cursor: creating ? 'not-allowed' : 'pointer',
          opacity: creating ? 0.6 : 1,
        }}
        title={`Create "IceBot — ${label} ${location}"`}
      >
        {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
        {!creating && 'New'}
      </button>
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

interface BotMeta {
  feature_flags: {
    booking_type?: string
    reminder_24h?: boolean
  }
  has_google_connected?: boolean
  google_connected_email?: string | null
}

// ─── Elken PIC Notifications Card ────────────────────────────────────────────

function ElkenPicCard({ botId }: { botId: string }) {
  const [okr, setOkr] = useState('')
  const [subang, setSubang] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/config/${botId}/pic-contacts`)
      .then((r) => r.json())
      .then((d: { okr?: string; subang?: string }) => {
        setOkr(d.okr ?? '')
        setSubang(d.subang ?? '')
      })
      .catch(() => toast.error('Failed to load PIC contacts'))
  }, [botId])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${botId}/pic-contacts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ okr, subang }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      toast.success('PIC numbers saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
    >
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--bb-text-1)' }}>
        PIC Notifications (Elken)
      </p>
      <p className="text-xs mb-4" style={{ color: 'var(--bb-text-3)' }}>
        WhatsApp numbers to notify for each GenQi location when a booking is made.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--bb-text-2)' }}>
            GenQi Old Klang Road PIC
          </label>
          <input
            type="text"
            value={okr}
            onChange={(e) => setOkr(e.target.value)}
            placeholder="+60122208396"
            className="w-full text-sm px-3 py-2 rounded"
            style={{
              background: 'var(--bb-surface-3)',
              border: '1px solid var(--bb-border)',
              color: 'var(--bb-text-1)',
              outline: 'none',
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--bb-text-2)' }}>
            GenQi Subang PIC
          </label>
          <input
            type="text"
            value={subang}
            onChange={(e) => setSubang(e.target.value)}
            placeholder="+60122206215"
            className="w-full text-sm px-3 py-2 rounded"
            style={{
              background: 'var(--bb-surface-3)',
              border: '1px solid var(--bb-border)',
              color: 'var(--bb-text-1)',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start text-xs px-3 py-1.5 rounded font-medium"
          style={{
            background: saving ? 'var(--bb-surface-3)' : 'var(--bb-primary)',
            color: saving ? 'var(--bb-text-3)' : '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save PIC Numbers'}
        </button>
      </div>
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ botId, googleParam, googleReason }: {
  botId: string
  googleParam?: string | null
  googleReason?: string | null
}) {
  const [bot, setBot] = useState<BotMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState<OperatingHoursRow[]>([])
  const [hoursLoaded, setHoursLoaded] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [calendarList, setCalendarList] = useState<{ id: string; summary: string }[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [calendarListLoading, setCalendarListLoading] = useState(false)
  const [calendarListError, setCalendarListError] = useState<string | null>(null)
  const [savingMap, setSavingMap] = useState(false)

  useEffect(() => {
    fetch(`/api/config/${botId}/settings`)
      .then((r) => r.json())
      .then((d: { settings?: BotMeta }) => setBot(d.settings ?? null))
      .catch(() => toast.error('Failed to load bot settings'))
      .finally(() => setLoading(false))

    fetch(`/api/bots/${botId}/operating-hours`)
      .then((r) => r.json())
      .then((d: { hours?: OperatingHoursRow[] }) => { setHours(d.hours ?? []); setHoursLoaded(true) })
      .catch(() => setHoursLoaded(true))
  }, [botId])

  const fetchCalendarData = useCallback(() => {
    if (!bot?.has_google_connected) return
    setCalendarListLoading(true)
    setCalendarListError(null)
    Promise.all([
      fetch(`/api/bots/${botId}/google-calendar/calendars`).then((r) => r.json()),
      fetch(`/api/bots/${botId}/google-calendar/resource-map`).then((r) => r.json()),
    ])
      .then(([calData, mapData]) => {
        const cal = calData as { calendars?: { id: string; summary: string }[] }
        const map = mapData as { mapping?: Record<string, string> }
        setCalendarList(cal.calendars ?? [])
        setMapping(map.mapping ?? {})
      })
      .catch(() => setCalendarListError('Could not load calendars'))
      .finally(() => setCalendarListLoading(false))
  }, [botId, bot?.has_google_connected])

  useEffect(() => { fetchCalendarData() }, [fetchCalendarData])

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Calendar? This will stop syncing bookings and clear all calendar mappings.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to disconnect')
      }
      // Update local state immediately — no page reload needed
      setBot((prev) => prev ? { ...prev, has_google_connected: false, google_connected_email: null } : prev)
      toast.success('Google Calendar disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSaveMapping() {
    setSavingMap(true)
    try {
      const res = await fetch(`/api/bots/${botId}/google-calendar/resource-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to save')
      }
      toast.success('Mapping saved')
    } catch (err) {
      console.error('[SettingsTab] handleSaveMapping failed:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setSavingMap(false)
    }
  }

  if (loading) {
    return <p className="text-sm py-8 text-center" style={{ color: 'var(--bb-text-3)' }}>Loading settings…</p>
  }

  if (!bot) {
    return <p className="text-sm py-8 text-center" style={{ color: 'var(--bb-text-3)' }}>Unable to load settings.</p>
  }

  const calendarConnected = !!bot.has_google_connected

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Booking type */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--bb-text-1)' }}>Booking Type</p>
        <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          Configured on bot creation. Current type:
          {' '}<strong style={{ color: 'var(--bb-text-2)' }} className="capitalize">
            {bot.feature_flags.booking_type?.replace(/_/g, ' ')}
          </strong>
        </p>
      </div>

      {/* Operating hours */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
      >
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--bb-text-1)' }}>Operating Hours</p>
        {hoursLoaded ? (
          <OperatingHours
            botId={botId}
            initialHours={hours}
            onSave={(updated) => setHours(updated)}
          />
        ) : (
          <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Loading…</p>
        )}
      </div>

      {/* 24h reminder */}
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>24h Reminder</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            Automatically remind customers 24 hours before their booking
          </p>
        </div>
        <button title="Toggle 24h reminder (stored in feature_flags.reminder_24h)">
          {bot.feature_flags.reminder_24h
            ? <ToggleRight size={24} style={{ color: 'var(--bb-primary)' }} />
            : <ToggleLeft size={24} style={{ color: 'var(--bb-text-3)' }} />
          }
        </button>
      </div>

      {/* Google Calendar */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>Google Calendar</p>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: calendarConnected ? 'rgba(34,197,94,0.15)' : 'var(--bb-surface-3)',
              color: calendarConnected ? '#22c55e' : 'var(--bb-text-3)',
            }}
          >
            {calendarConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {/* OAuth result banners */}
        {googleParam === 'connected' && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded mb-3"
            style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
            <Check size={12} /> Google Calendar connected successfully.
          </div>
        )}
        {googleParam === 'cancelled' && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded mb-3"
            style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)', border: '1px solid var(--bb-border)' }}>
            <X size={12} /> Connection cancelled. You can try again below.
          </div>
        )}
        {googleParam === 'error' && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded mb-3"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={12} />
            {googleReason === 'expired'
              ? 'Connection request expired. Please try again.'
              : googleReason === 'auth_mismatch'
              ? 'Session mismatch — please sign in again and retry.'
              : googleReason === 'no_refresh_token'
              ? 'Google did not return a refresh token. Please revoke access at myaccount.google.com and try again.'
              : 'Connection failed. Please try again or check server logs.'}
          </div>
        )}

        <p className="text-xs mb-3" style={{ color: 'var(--bb-text-3)' }}>
          {calendarConnected
            ? bot.google_connected_email
              ? `Connected as ${bot.google_connected_email}. Confirmed bookings will be synced to your Google Calendar.`
              : 'Confirmed bookings will be synced to your Google Calendar.'
            : 'Connect Google Calendar to automatically sync confirmed bookings.'}
        </p>

        {calendarConnected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', opacity: disconnecting ? 0.6 : 1 }}
          >
            <X size={12} /> {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <a
            href={`/api/auth/google?botId=${botId}`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            <Calendar size={12} /> Connect Google Calendar
          </a>
        )}
      </div>

      {/* Google Calendar Resource Mapping — shown only when connected */}
      {calendarConnected && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium" style={{ color: 'var(--bb-text-1)' }}>Resource Calendars</p>
            {calendarListLoading && (
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--bb-text-3)' }} />
            )}
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--bb-text-3)' }}>
            Map each resource to a specific Google Calendar. Unmapped resources use your primary calendar.
          </p>

          {calendarListError ? (
            <div
              className="flex items-center justify-between text-xs px-3 py-2 rounded mb-3"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <span>{calendarListError}</span>
              <button
                onClick={fetchCalendarData}
                className="flex items-center gap-1 ml-3 flex-shrink-0"
                style={{ color: '#ef4444' }}
              >
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          ) : calendarListLoading ? (
            <div className="flex flex-col gap-2">
              {ELKEN_RESOURCE_MAP.map(({ key }) => (
                <div
                  key={key}
                  className="h-8 rounded animate-pulse"
                  style={{ background: 'var(--bb-surface-3)' }}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                {ELKEN_RESOURCE_MAP.map(({ key, label, location }) => {
                  const isDuplicate =
                    !!mapping[key] &&
                    ELKEN_RESOURCE_MAP.some((r) => r.key !== key && mapping[r.key] === mapping[key])
                  return (
                    <ResourceMapRow
                      key={key}
                      botId={botId}
                      resourceKey={key}
                      label={label}
                      location={location}
                      calendarList={calendarList}
                      currentCalendarId={mapping[key] ?? ''}
                      isDuplicate={isDuplicate}
                      onChange={(calId) =>
                        setMapping((prev) => ({ ...prev, [key]: calId }))
                      }
                      onCalendarCreated={(newCal) =>
                        setCalendarList((prev) =>
                          [...prev, newCal].sort((a, b) =>
                            a.summary.localeCompare(b.summary)
                          )
                        )
                      }
                    />
                  )
                })}
              </div>
              <button
                onClick={handleSaveMapping}
                disabled={savingMap}
                className="mt-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-medium"
                style={{
                  background: savingMap ? 'var(--bb-surface-3)' : 'var(--bb-primary)',
                  color: savingMap ? 'var(--bb-text-3)' : '#fff',
                  cursor: savingMap ? 'not-allowed' : 'pointer',
                }}
              >
                {savingMap && <Loader2 size={11} className="animate-spin" />}
                {savingMap ? 'Saving…' : 'Save Mapping'}
              </button>
            </>
          )}
        </div>
      )}

      {/* PIC Notifications — Elken only */}
      {botId === ELKEN_BOT_ID && <ElkenPicCard botId={botId} />}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = 'bookings' | 'services' | 'settings'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'bookings', label: 'Bookings',  icon: <CalendarDays size={14} /> },
  { id: 'services', label: 'Services',  icon: <Briefcase size={14} /> },
  { id: 'settings', label: 'Settings',  icon: <Settings size={14} /> },
]

export default function BookingPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params)
  const searchParams = useSearchParams()
  const googleParam = searchParams.get('google')
  const googleReason = searchParams.get('reason')
  // Auto-switch to settings tab when returning from Google OAuth
  const initialTab = (searchParams.get('tab') as TabId | null) ?? 'bookings'
  const [tab, setTab] = useState<TabId>(initialTab)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>Booking</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            Manage appointments, services, and availability
          </p>
        </div>
        {tab === 'bookings' && (
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded font-medium"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            <Plus size={14} /> New Booking
          </button>
        )}
      </div>

      {/* Tab nav */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
      >
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md font-medium transition-colors"
            style={{
              background: tab === id ? 'var(--bb-surface-3)' : 'transparent',
              color: tab === id ? 'var(--bb-text-1)' : 'var(--bb-text-3)',
              borderLeft: tab === id ? '3px solid var(--bb-primary)' : '3px solid transparent',
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'bookings' && <BookingsTab botId={botId} sheetOpen={sheetOpen} setSheetOpen={setSheetOpen} />}
      {tab === 'services' && <ServicesTab botId={botId} />}
      {tab === 'settings' && <SettingsTab botId={botId} googleParam={googleParam} googleReason={googleReason} />}
    </div>
  )
}
