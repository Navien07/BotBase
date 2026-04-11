'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { RefreshCw, ExternalLink, Bot } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface BotRow {
  id: string
  name: string
  slug: string
  is_active: boolean
  tenant_id: string
  tenant_name: string
  total_messages_7d: number
  error_rate: number
  created_at: string
}

const columnHelper = createColumnHelper<BotRow>()

export default function AdminBotsPage() {
  const [bots, setBots] = useState<BotRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBots = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bots')
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      const json = await res.json() as { bots: BotRow[] }
      setBots(json.bots)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load bots')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBots() }, [fetchBots])

  const columns = [
    columnHelper.accessor('name', {
      header: 'Bot Name',
      cell: (info) => (
        <span className="font-medium" style={{ color: 'var(--bb-text-1)' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('tenant_name', {
      header: 'Tenant',
      cell: (info) => (
        <span className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('is_active', {
      header: 'Status',
      cell: (info) => (
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: info.getValue() ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: info.getValue() ? 'var(--bb-success)' : 'var(--bb-danger)',
          }}
        >
          {info.getValue() ? 'Active' : 'Inactive'}
        </span>
      ),
    }),
    columnHelper.accessor('total_messages_7d', {
      header: 'Messages (7d)',
      cell: (info) => (
        <span style={{ color: 'var(--bb-text-2)' }}>
          {info.getValue().toLocaleString()}
        </span>
      ),
    }),
    columnHelper.accessor('error_rate', {
      header: 'Error Rate',
      cell: (info) => {
        const rate = info.getValue()
        const isHigh = rate > 5
        return (
          <span
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{
              background: isHigh ? 'rgba(239,68,68,0.1)' : 'transparent',
              color: isHigh ? 'var(--bb-danger)' : 'var(--bb-text-2)',
            }}
          >
            {rate.toFixed(1)}%
          </span>
        )
      },
    }),
    columnHelper.accessor('created_at', {
      header: 'Created',
      cell: (info) => (
        <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          {formatDistanceToNow(new Date(info.getValue()), { addSuffix: true })}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Link
          href={`/dashboard/bots/${row.original.id}/conversations`}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--bb-primary)' }}
        >
          <ExternalLink size={11} />
          Conversations
        </Link>
      ),
    }),
  ]

  const table = useReactTable({
    data: bots,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            All Bots
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
            Monitor bots across all tenants
          </p>
        </div>
        <button
          onClick={fetchBots}
          className="p-2 rounded-lg transition-colors"
          style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden overflow-x-auto"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading bots…</span>
          </div>
        ) : (
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
                  <td colSpan={columns.length}>
                    <EmptyState
                      icon={Bot}
                      title="No bots found"
                      description="Bots will appear here once tenants create them"
                    />
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
        )}
      </div>
    </div>
  )
}
