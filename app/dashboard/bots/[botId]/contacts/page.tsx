'use client'

import { useState, useEffect, useCallback, use } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  getSortedRowModel,
} from '@tanstack/react-table'
import {
  Search, Download, Upload, LayoutGrid, Table2,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
  User, Phone, Mail,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import type { Contact, LeadStage } from '@/types/database'
import { ContactProfileSheet } from '@/components/contacts/ContactProfileSheet'
import { KanbanView } from '@/components/contacts/KanbanView'
import { ImportModal } from '@/components/contacts/ImportModal'
import { EmptyState } from '@/components/shared/EmptyState'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<LeadStage, { bg: string; text: string }> = {
  new: { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
  engaged: { bg: 'rgba(34,211,238,0.15)', text: '#22d3ee' },
  qualified: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  booked: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  converted: { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' },
  churned: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
}

const CHANNEL_ICON: Record<string, string> = {
  whatsapp: '📱', telegram: '✈️', web_widget: '🌐',
  instagram: '📷', facebook: '📘', api: '🔗', manual: '✏️', import: '📂',
}

const LEAD_STAGES: LeadStage[] = ['new', 'engaged', 'qualified', 'booked', 'converted', 'churned']

function StageBadge({ stage }: { stage: LeadStage }) {
  const { bg, text } = STAGE_COLORS[stage]
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
      style={{ background: bg, color: text }}
    >
      {stage}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: 'var(--bb-surface-3)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: 'var(--bb-primary)' }}
        />
      </div>
      <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>{score}</span>
    </div>
  )
}

// ─── Column defs ──────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Contact>()

function buildColumns(onRowClick: (c: Contact) => void) {
  return [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => {
        const c = info.row.original
        const display = c.name ?? c.phone ?? c.email ?? 'Unknown'
        return (
          <button
            className="flex items-center gap-2 text-left hover:underline"
            onClick={() => onRowClick(c)}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {display.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-sm" style={{ color: 'var(--bb-text-1)' }}>{display}</span>
          </button>
        )
      },
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      cell: (info) => (
        <span className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
          {info.getValue() ?? '—'}
        </span>
      ),
    }),
    columnHelper.accessor('channel', {
      header: 'Channel',
      cell: (info) => (
        <span className="text-base">{CHANNEL_ICON[info.getValue()] ?? '💬'}</span>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('language', {
      header: 'Lang',
      cell: (info) => (
        <span className="text-xs uppercase font-mono" style={{ color: 'var(--bb-text-3)' }}>
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('lead_stage', {
      header: 'Stage',
      cell: (info) => <StageBadge stage={info.getValue()} />,
    }),
    columnHelper.accessor('lead_score', {
      header: 'Score',
      cell: (info) => <ScoreBar score={info.getValue()} />,
    }),
    columnHelper.accessor('last_message_at', {
      header: 'Last Message',
      cell: (info) => {
        const val = info.getValue()
        return (
          <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
            {val ? formatDistanceToNow(new Date(val), { addSuffix: true }) : '—'}
          </span>
        )
      },
    }),
    columnHelper.accessor('tags', {
      header: 'Tags',
      enableSorting: false,
      cell: (info) => {
        const tags = info.getValue()
        if (!tags || tags.length === 0) return null
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)' }}
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>+{tags.length - 2}</span>
            )}
          </div>
        )
      },
    }),
  ]
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContactsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params)

  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')

  // UI state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(search && { search }),
        ...(stageFilter && { lead_stage: stageFilter }),
        ...(channelFilter && { channel: channelFilter }),
        ...(sorting.length > 0 && { sort: sorting[0].id, order: sorting[0].desc ? 'desc' : 'asc' }),
      })
      const res = await fetch(`/api/contacts/${botId}?${sp}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setContacts(data.contacts)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [botId, page, search, stageFilter, channelFilter, sorting])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300)
    return () => clearTimeout(t)
  }, [search])

  function handleContactUpdate(updated: Contact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    if (selectedContact?.id === updated.id) setSelectedContact(updated)
  }

  function handleExport() {
    const sp = new URLSearchParams({
      ...(search && { search }),
      ...(stageFilter && { lead_stage: stageFilter }),
      ...(channelFilter && { channel: channelFilter }),
    })
    window.open(`/api/contacts/${botId}/export?${sp}`, '_blank')
  }

  const columns = buildColumns((c) => setSelectedContact(c))

  const table = useReactTable({
    data: contacts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--bb-text-1)' }}>Contacts</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bb-text-3)' }}>
            {total.toLocaleString()} total contacts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
          >
            <Upload size={14} />Import
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
            style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
          >
            <Download size={14} />Export
          </button>
          {/* View toggle */}
          <div
            className="flex rounded overflow-hidden"
            style={{ border: '1px solid var(--bb-border)' }}
          >
            {(['table', 'kanban'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex items-center gap-1 px-3 py-1.5"
                style={{
                  background: view === v ? 'var(--bb-primary)' : 'var(--bb-surface-2)',
                  color: view === v ? '#fff' : 'var(--bb-text-2)',
                }}
              >
                {v === 'table' ? <Table2 size={14} /> : <LayoutGrid size={14} />}
                <span className="text-xs capitalize">{v}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center gap-2 flex-1 max-w-xs px-3 py-1.5 rounded"
          style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)' }}
        >
          <Search size={13} style={{ color: 'var(--bb-text-3)', flexShrink: 0 }} />
          <input
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: 'var(--bb-text-1)' }}
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="text-sm px-2 py-1.5 rounded outline-none"
          style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
          value={stageFilter}
          onChange={(e) => { setStageFilter(e.target.value); setPage(1) }}
        >
          <option value="">All stages</option>
          {LEAD_STAGES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>

        <select
          className="text-sm px-2 py-1.5 rounded outline-none"
          style={{ background: 'var(--bb-surface-2)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-2)' }}
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value); setPage(1) }}
        >
          <option value="">All channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
          <option value="web_widget">Web Widget</option>
          <option value="manual">Manual</option>
          <option value="import">Import</option>
        </select>

        {(search || stageFilter || channelFilter) && (
          <button
            className="text-xs px-2 py-1.5 rounded"
            style={{ color: 'var(--bb-text-3)' }}
            onClick={() => { setSearch(''); setStageFilter(''); setChannelFilter(''); setPage(1) }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table / Kanban */}
      {view === 'kanban' ? (
        <KanbanView
          contacts={contacts}
          botId={botId}
          onCardClick={(c) => setSelectedContact(c)}
          onContactUpdate={handleContactUpdate}
        />
      ) : (
        <>
          <div
            className="rounded-xl overflow-hidden overflow-x-auto"
            style={{ border: '1px solid var(--bb-border)' }}
          >
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} style={{ background: 'var(--bb-surface-2)', borderBottom: '1px solid var(--bb-border)' }}>
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
                    <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--bb-text-3)' }}>
                      Loading contacts…
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={User}
                        title="No contacts yet"
                        description="Contacts appear when users message your bot"
                      />
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-white/[0.02] cursor-pointer"
                      style={{ borderTop: '1px solid var(--bb-border-subtle)' }}
                      onClick={() => setSelectedContact(row.original)}
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
                Page {page} of {totalPages} · {total} contacts
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

      {/* Contact Profile Sheet */}
      {selectedContact && (
        <ContactProfileSheet
          contact={selectedContact}
          botId={botId}
          onClose={() => setSelectedContact(null)}
          onUpdate={handleContactUpdate}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          botId={botId}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchContacts() }}
        />
      )}
    </div>
  )
}
