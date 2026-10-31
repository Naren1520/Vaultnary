import { useEffect, useState } from 'react'
import Topbar from '../../components/ui/Topbar'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet, apiDelete } from '../../services/http-client'
import type { SessionRecord } from '../auth/types'

export default function SecurityCenterPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    apiGet<{ data: SessionRecord[] }>('/api/v1/security/sessions', { signal: ctrl.signal })
      .then((r) => setSessions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  async function revokeSession(id: string) {
    await apiDelete(`/api/v1/auth/sessions/${id}`)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  const columns: Column<SessionRecord>[] = [
    { key: 'ip_address', header: 'IP Address', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{r.ip_address ?? '—'}</span> },
    { key: 'user_agent', header: 'Device', render: (r) => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{r.user_agent ?? '—'}</span> },
    { key: 'created_at', header: 'Created', sortable: true, render: (r) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{new Date(r.created_at).toLocaleString()}</span>, width: '10rem' },
    { key: 'last_used_at', header: 'Last used', render: (r) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{r.last_used_at ? new Date(r.last_used_at).toLocaleString() : '—'}</span>, width: '10rem' },
    {
      key: 'actions', header: '', width: '6rem',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); void revokeSession(r.id) }}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', padding: '2px var(--space-2)', backgroundColor: 'transparent', cursor: 'pointer' }}
        >
          Revoke
        </button>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Security Center', href: '/app/security' }]} />
      <div style={{ padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>Active Sessions</h2>
        {loading
          ? <SkeletonLoader variant="table-row" rows={4} />
          : <DataTable columns={columns} rows={sessions} getRowKey={(r) => r.id} caption="Active sessions" emptyState={<EmptyState title="No active sessions" />} />}
      </div>
    </div>
  )
}
