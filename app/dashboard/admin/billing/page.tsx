'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { RefreshCw, Download } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TenantUsage {
  tenant_id: string
  tenant_name: string
  bot_count: number
  total_conversations: number
  total_messages: number
  created_at: string
}

const columnHelper = createColumnHelper<TenantUsage>()

export default function AdminBillingPage() {
  const [tenants, setTenants] = useState<TenantUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/billing')
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      const json = await res.json() as { tenants: TenantUsage[] }
      setTenants(json.tenants)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleExportCSV() {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/billing?format=csv')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'usage.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const totals = tenants.reduce(
    (acc, t) => ({
      bot_count: acc.bot_count + t.bot_count,
      total_conversations: acc.total_conversations + t.total_conversations,
      total_messages: acc.total_messages + t.total_messages,
    }),
    { bot_count: 0, total_conversations: 0, total_messages: 0 }
  )

  const columns = [
    columnHelper.accessor('tenant_name', {
      header: 'Tenant',
      cell: (info) => (
        <span className="font-medium" style={{ color: 'var(--bb-text-1)' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('bot_count', {
      header: 'Bots',
      cell: (info) => (
        <span style={{ color: 'var(--bb-text-2)' }}>{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('total_conversations', {
      header: 'Conversations',
      cell: (info) => (
        <span style={{ color: 'var(--bb-text-2)' }}>{info.getValue().toLocaleString()}</span>
      ),
    }),
    columnHelper.accessor('total_messages', {
      header: 'Messages',
      cell: (info) => (
        <span style={{ color: 'var(--bb-text-2)' }}>{info.getValue().toLocaleString()}</span>
      ),
    }),
    columnHelper.accessor('created_at', {
      header: 'Member Since',
      cell: (info) => (
        <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          {formatDistanceToNow(new Date(info.getValue()), { addSuffix: true })}
        </span>
      ),
    }),
  ]

  const table = useReactTable({
    data: tenants,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            Billing &amp; Usage
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
            Per-tenant usage across all bots
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg transition-colors"
            style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-1)', border: '1px solid var(--bb-border)' }}
          >
            <Download size={15} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {!loading && tenants.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Tenants', value: tenants.length },
            { label: 'Total Bots', value: totals.bot_count },
            { label: 'Total Messages', value: totals.total_messages.toLocaleString() },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl p-4 border"
              style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--bb-text-2)' }}>
                {kpi.label}
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--bb-text-1)' }}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden overflow-x-auto"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading usage data…</span>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    style={{ borderBottom: '1px solid var(--bb-border)', background: 'var(--bb-surface-2)' }}
                  >
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--bb-text-3)' }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-12" style={{ color: 'var(--bb-text-3)' }}>
                      No usage data found
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: '1px solid var(--bb-border-subtle)' }}
                      className="transition-colors hover:bg-[var(--bb-surface-2)]"
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

            {/* Totals row */}
            {tenants.length > 0 && (
              <div
                className="flex items-center gap-8 px-4 py-3 text-sm font-semibold"
                style={{
                  borderTop: '2px solid var(--bb-border)',
                  background: 'var(--bb-surface-2)',
                  color: 'var(--bb-text-1)',
                }}
              >
                <span className="flex-1">Totals</span>
                <span style={{ minWidth: 60 }}>{totals.bot_count} bots</span>
                <span style={{ minWidth: 120 }}>{totals.total_conversations.toLocaleString()} convs</span>
                <span style={{ minWidth: 120 }}>{totals.total_messages.toLocaleString()} msgs</span>
                <span style={{ minWidth: 140 }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
