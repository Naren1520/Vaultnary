import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'

interface Service { id: string; name: string; environment: string; description: string | null }

export default function ServiceDetail() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!serviceId) return
    const ctrl = new AbortController()
    apiGet<{ data: Service }>(`/api/v1/services/${serviceId}`, { signal: ctrl.signal })
      .then((r) => setService(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [serviceId])

  if (loading) return <SkeletonLoader variant="detail-panel" />
  if (!service) return <EmptyState title="Service not found" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Services', href: '/app/services' }, { label: service.name, href: `/app/services/${service.id}` }]} />
      <div style={{ padding: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>{service.name}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>Environment: {service.environment}</p>
        {service.description && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{service.description}</p>}
      </div>
    </div>
  )
}
