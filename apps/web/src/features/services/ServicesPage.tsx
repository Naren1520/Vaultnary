import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'

interface Service { id: string; name: string; environment: string; description: string | null; created_at: string }

const columns: Column<Service>[] = [
  { key: 'name', header: 'Name', sortable: true, render: (r) => <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{r.name}</span> },
  { key: 'environment', header: 'Environment', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{r.environment}</span>, width: '8rem' },
  { key: 'description', header: 'Description', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{r.description ?? '—'}</span> },
]

export default function ServicesPage() {
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    apiGet<{ data: Service[] }>('/api/v1/services', { signal: ctrl.signal })
      .then((r) => setServices(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Services', href: '/app/services' }]} />
      <div style={{ padding: 'var(--space-4)', flex: 1 }}>
        {loading
          ? <SkeletonLoader variant="table-row" rows={5} />
          : <DataTable columns={columns} rows={services} getRowKey={(r) => r.id} onRowClick={(r) => navigate(`/app/services/${r.id}`)} caption="Services" emptyState={<EmptyState title="No services" message="Create a service to link credentials to environments." />} />}
      </div>
    </div>
  )
}
