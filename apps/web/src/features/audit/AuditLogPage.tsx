import { useEffect, useState } from 'react'
import Topbar from '../../components/ui/Topbar'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'

interface AuditEvent {
  id: string
  action_type: string
  resource_type: string | null
  ip_address: string | null
  metadata: Record<string, unknown>
  created_at: string
}

const columns: Column<AuditEvent>[] = [
  { key: 'action_type', header: 'Action', sortable: true, render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{r.action_type}</span> },
  { key: 'resource_type', header: 'Resource', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{r.resource_type ?? '—'}</span>, width: '8rem' },
  { key: 'ip_address', header: 'IP', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{r.ip_address ?? '—'}</span>, width: '9rem' },
  { key: 'created_at', header: 'Time', sortable: true, render: (r) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{new Date(r.created_at).toLocaleString()}</span>, width: '11rem' },
]

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    apiGet<{ data: AuditEvent[] }>('/api/v1/audit/events', { signal: ctrl.signal })
      .then((r) => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const filtered = actionFilter
    ? events.filter((e) => e.action_type.includes(actionFilter.toLowerCase()))
    : events

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Audit Log', href: '/app/audit' }]} />
      <div style={{ padding: 'var(--space-4)', flex: 1, overflowY: 'auto' }}>
        {/* Filters */}
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <label htmlFor="action-filter" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Filter by action</label>
          <input
            id="action-filter"
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. user.login"
            style={{ padding: 'var(--space-1) var(--space-3)', border: 'var(--border-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', width: '16rem' }}
          />
        </div>

        {loading
          ? <SkeletonLoader variant="table-row" rows={8} />
          : <DataTable
              columns={columns}
              rows={filtered}
              getRowKey={(r) => r.id}
              caption="Audit events"
              emptyState={<EmptyState title="No audit events" message="Security events will appear here." />}
            />}
      </div>
    </div>
  )
}
