import { useEffect, useState } from 'react'
import { Clock3, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import Topbar from '../../components/ui/Topbar'
import { apiGet } from '../../services/http-client'

interface DeletedVault {
  id: string
  name: string
  original_created_at: string
  destroyed_at: string
  reason: 'scheduled' | 'manual'
}

export default function DeletedVaultsPage() {
  const [vaults, setVaults] = useState<DeletedVault[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiGet<{ data: DeletedVault[] }>('/api/v1/vaults/deleted', { signal: controller.signal })
      .then((response) => {
        setVaults(response.data)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load deleted vaults.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  if (loading) return <SkeletonLoader variant="detail-panel" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Workspaces', href: '/app/workspaces' }, { label: 'Deleted vaults', href: '/app/deleted-vaults' }]} showSearch={false} />
      <main className="app-page-content" style={{ padding: 'var(--space-6)' }}>
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">Deletion record</p>
          <h1>Deleted vaults</h1>
          <p>Names and timestamps are retained for audit purposes.</p>
        </header>
        {error && <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {error ? null : vaults.length === 0 ? (
          <p>No vaults have been deleted.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
            {vaults.map((vault) => (
              <li key={vault.id} style={{ border: 'var(--border-card)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <Link
                  to={`/app/deleted-vaults/${vault.id}`}
                  state={{ vault }}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'inherit', textDecoration: 'none' }}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  <span style={{ flex: 1 }}>
                    <strong>{vault.name}</strong>
                    <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      Deleted {new Date(vault.destroyed_at).toLocaleString()} · {vault.reason}
                    </span>
                  </span>
                  <Clock3 size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
