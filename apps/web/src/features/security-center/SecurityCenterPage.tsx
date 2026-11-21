import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet, apiDelete } from '../../services/http-client'
import type { SessionRecord } from '../auth/types'
import { AuditLogPanel } from '../audit/AuditLogPage'
import MonitoringPanel from './MonitoringPanel'

export default function SecurityCenterPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = requestedTab === 'audit' || requestedTab === 'monitoring' ? requestedTab : 'sessions'

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
    { key: 'ip_address', header: 'IP Address', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{r.ip_address ?? '-'}</span> },
    { key: 'user_agent', header: 'Device', render: (r) => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{r.user_agent ?? '-'}</span> },
    { key: 'created_at', header: 'Created', sortable: true, render: (r) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{new Date(r.created_at).toLocaleString()}</span>, width: '10rem' },
    { key: 'last_used_at', header: 'Last used', render: (r) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{r.last_used_at ? new Date(r.last_used_at).toLocaleString() : '-'}</span>, width: '10rem' },
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
      <div className="app-page-content" style={{ padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }}>
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">Account protection</p>
          <h1>Security</h1>
          <p>Review sessions, activity, and your connection to Vaultnary.</p>
        </header>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <button
            type="button"
            aria-pressed={activeTab === 'sessions'}
            onClick={() => setSearchParams((current) => {
              const next = new URLSearchParams(current)
              next.delete('tab')
              return next
            })}
            style={{ padding: 'var(--space-2) var(--space-3)', border: 0, borderBottom: activeTab === 'sessions' ? '2px solid var(--color-accent)' : '2px solid transparent', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            Active sessions
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'audit'}
            onClick={() => setSearchParams((current) => {
              const next = new URLSearchParams(current)
              next.set('tab', 'audit')
              return next
            })}
            style={{ padding: 'var(--space-2) var(--space-3)', border: 0, borderBottom: activeTab === 'audit' ? '2px solid var(--color-accent)' : '2px solid transparent', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            Audit log
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'monitoring'}
            onClick={() => setSearchParams((current) => {
              const next = new URLSearchParams(current)
              next.set('tab', 'monitoring')
              return next
            })}
            style={{ padding: 'var(--space-2) var(--space-3)', border: 0, borderBottom: activeTab === 'monitoring' ? '2px solid var(--color-accent)' : '2px solid transparent', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            Monitoring
          </button>
        </div>
        <section>
          {activeTab === 'audit'
            ? <AuditLogPanel />
            : activeTab === 'monitoring'
              ? <MonitoringPanel />
              : loading
              ? <SkeletonLoader variant="table-row" rows={4} />
              : <DataTable columns={columns} rows={sessions} getRowKey={(r) => r.id} caption="Active sessions" emptyState={<EmptyState title="No active sessions" />} />}
        </section>
      </div>
    </div>
  )
}
