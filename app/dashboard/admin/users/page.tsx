'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import { RefreshCw, Save } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { UserRole } from '@/types/database'

interface UserRow {
  id: string
  display_name: string | null
  email: string
  role: UserRole
  tenant_id: string | null
  tenant_name: string | null
  created_at: string
  // local editable state
  _role: UserRole
  _tenantId: string | null
  _saving: boolean
}

interface TenantOption {
  id: string
  name: string
}

const columnHelper = createColumnHelper<UserRow>()

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, tenantsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/tenants'),
      ])
      if (!usersRes.ok) throw new Error((await usersRes.json() as { error: string }).error)
      if (!tenantsRes.ok) throw new Error((await tenantsRes.json() as { error: string }).error)

      const usersJson = await usersRes.json() as { users: Omit<UserRow, '_role' | '_tenantId' | '_saving'>[] }
      const tenantsJson = await tenantsRes.json() as { tenants: TenantOption[] }

      setTenants(tenantsJson.tenants)
      setUsers(
        usersJson.users.map((u) => ({
          ...u,
          _role: u.role,
          _tenantId: u.tenant_id,
          _saving: false,
        }))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function updateLocal(userId: string, patch: Partial<Pick<UserRow, '_role' | '_tenantId' | '_saving'>>) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...patch } : u))
  }

  async function handleSave(user: UserRow) {
    updateLocal(user.id, { _saving: true })
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: user._role,
          tenantId: user._tenantId,
        }),
      })
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      toast.success('User updated')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
      updateLocal(user.id, { _saving: false })
    }
  }

  const columns = [
    columnHelper.accessor('display_name', {
      header: 'Name',
      cell: (info) => (
        <span className="font-medium" style={{ color: 'var(--bb-text-1)' }}>
          {info.getValue() ?? '—'}
        </span>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => (
        <span className="text-sm font-mono" style={{ color: 'var(--bb-text-2)' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'role_edit',
      header: 'Role',
      cell: ({ row }) => (
        <select
          value={row.original._role}
          onChange={(e) => updateLocal(row.original.id, { _role: e.target.value as UserRole })}
          className="px-2 py-1 rounded text-xs border outline-none"
          style={{
            background: 'var(--bb-surface-2)',
            borderColor: 'var(--bb-border)',
            color: 'var(--bb-text-1)',
          }}
        >
          <option value="super_admin">Super Admin</option>
          <option value="tenant_admin">Tenant Admin</option>
          <option value="agent">Agent</option>
        </select>
      ),
    }),
    columnHelper.display({
      id: 'tenant_edit',
      header: 'Tenant',
      cell: ({ row }) => (
        <select
          value={row.original._tenantId ?? ''}
          onChange={(e) => updateLocal(row.original.id, { _tenantId: e.target.value || null })}
          className="px-2 py-1 rounded text-xs border outline-none max-w-[180px]"
          style={{
            background: 'var(--bb-surface-2)',
            borderColor: 'var(--bb-border)',
            color: 'var(--bb-text-1)',
          }}
        >
          <option value="">— None —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      ),
    }),
    columnHelper.accessor('created_at', {
      header: 'Joined',
      cell: (info) => (
        <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          {formatDistanceToNow(new Date(info.getValue()), { addSuffix: true })}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'save',
      header: '',
      cell: ({ row }) => {
        const u = row.original
        const isDirty = u._role !== u.role || u._tenantId !== u.tenant_id
        return (
          <button
            onClick={() => handleSave(u)}
            disabled={u._saving || !isDirty}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors disabled:opacity-40"
            style={{
              background: isDirty ? 'rgba(99,102,241,0.15)' : 'var(--bb-surface-2)',
              color: isDirty ? 'var(--bb-primary)' : 'var(--bb-text-3)',
            }}
          >
            <Save size={11} />
            {u._saving ? 'Saving…' : 'Save'}
          </button>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            Users
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--bb-text-2)' }}>
            Manage roles and tenant assignments for all users
          </p>
        </div>
        <button
          onClick={fetchData}
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
            <span className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Loading users…</span>
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
                  <td colSpan={columns.length} className="text-center py-12" style={{ color: 'var(--bb-text-3)' }}>
                    No users found
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
