'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { Plus, UserPlus, RefreshCw, Building2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDistanceToNow } from 'date-fns'

interface TenantRow {
  id: string
  name: string
  slug: string
  is_active: boolean
  bots_count: number
  created_at: string
}

const columnHelper = createColumnHelper<TenantRow>()

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  // New Tenant modal state
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)

  // Invite modal state
  const [inviteTenantId, setInviteTenantId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'tenant_admin' | 'agent'>('agent')
  const [inviting, setInviting] = useState(false)

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tenants')
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      const json = await res.json() as { tenants: TenantRow[] }
      setTenants(json.tenants)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  async function handleToggleActive(tenant: TenantRow) {
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tenant.is_active }),
      })
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      toast.success(tenant.is_active ? 'Tenant suspended' : 'Tenant activated')
      await fetchTenants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function handleCreateTenant() {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Name and email are required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), role: 'tenant_admin' }),
      })
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      toast.success('Tenant created and invite sent')
      setShowNewModal(false)
      setNewName('')
      setNewEmail('')
      await fetchTenants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tenant')
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteTenantId) return
    setInviting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${inviteTenantId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      toast.success('Invite sent successfully')
      setInviteTenantId(null)
      setInviteEmail('')
      setInviteRole('agent')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const columns = [
    columnHelper.accessor('name', {
      header: 'Tenant Name',
      cell: (info) => (
        <span className="font-medium" style={{ color: 'var(--bb-text-1)' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('slug', {
      header: 'Slug',
      cell: (info) => (
        <span className="font-mono text-xs" style={{ color: 'var(--bb-text-2)' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('bots_count', {
      header: 'Bots',
      cell: (info) => (
        <span style={{ color: 'var(--bb-text-2)' }}>{info.getValue()}</span>
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
          {info.getValue() ? 'Active' : 'Suspended'}
        </span>
      ),
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
      cell: ({ row }) => {
        const t = row.original
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleActive(t)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: t.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                color: t.is_active ? 'var(--bb-danger)' : 'var(--bb-success)',
              }}
            >
              {t.is_active ? 'Suspend' : 'Activate'}
            </button>
            <button
              onClick={() => {
                setInviteTenantId(t.id)
                setInviteEmail('')
                setInviteRole('agent')
              }}
              className="text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors"
              style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--bb-primary)' }}
            >
              <UserPlus size={12} />
              Invite
            </button>
          </div>
        )
      },
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
            Tenants
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
            Manage all client tenants and send invites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTenants}
            className="p-2 rounded-lg transition-colors"
            style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => { setShowNewModal(true); setNewName(''); setNewEmail('') }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--bb-primary)', color: '#fff' }}
          >
            <Plus size={15} />
            New Tenant
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden overflow-x-auto"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading tenants…</span>
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
                      icon={Building2}
                      title="No tenants yet"
                      description="Create your first tenant to get started"
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

      {/* New Tenant Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full max-w-md rounded-xl border p-6 space-y-4"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--bb-text-1)' }}>
              New Tenant
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--bb-text-2)' }}>
                  Company Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    borderColor: 'var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--bb-text-2)' }}>
                  Admin Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    borderColor: 'var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTenant}
                disabled={creating}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                {creating ? 'Creating…' : 'Create & Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {inviteTenantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full max-w-md rounded-xl border p-6 space-y-4"
            style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--bb-text-1)' }}>
              Invite User
            </h2>
            <p className="text-xs" style={{ color: 'var(--bb-text-2)' }}>
              Tenant: <strong>{tenants.find((t) => t.id === inviteTenantId)?.name}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--bb-text-2)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    borderColor: 'var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--bb-text-2)' }}>
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'tenant_admin' | 'agent')}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    borderColor: 'var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                >
                  <option value="tenant_admin">Tenant Admin</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setInviteTenantId(null)}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
