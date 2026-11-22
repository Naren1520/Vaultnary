import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DataTable, { type Column } from '../../components/ui/DataTable'
import EmptyState from '../../components/feedback/EmptyState'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import Topbar from '../../components/ui/Topbar'
import { apiGet } from '../../services/http-client'

interface Vault {
  id: string
  workspace_id: string
  workspace_name: string
  project_id: string
  project_name: string
  service_id: string
  service_name: string
  environment: string
  name: string
  created_at: string
}

const columns: Column<Vault>[] = [
  { key: 'name', header: 'Vault', sortable: true, render: (vault) => vault.name },
  { key: 'workspace_name', header: 'Workspace', sortable: true, render: (vault) => vault.workspace_name },
  { key: 'project_name', header: 'Project', sortable: true, render: (vault) => vault.project_name },
  { key: 'service_name', header: 'Service', sortable: true, render: (vault) => vault.service_name },
  { key: 'environment', header: 'Environment', sortable: true, render: (vault) => vault.environment },
]

export default function VaultsPage() {
  const navigate = useNavigate()
  const [vaults, setVaults] = useState<Vault[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    apiGet<{ data: Vault[] }>('/api/v1/vaults', { signal: controller.signal })
      .then((response) => {
        setVaults(response.data)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load service vaults.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [retryCount])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Topbar breadcrumbs={[{ label: 'Vaults', href: '/app/vault' }]} />
      <div className="app-page-content" style={{ flex: 1, overflowY: 'auto' }}>
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">Services</p>
          <h1>Vaults</h1>
          <p>Credentials live in vaults owned by a service.</p>
        </header>
        {error && (
          <div role="alert" style={{ marginBottom: 'var(--space-4)', color: 'var(--color-danger)' }}>
            <p>{error}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <SkeletonLoader variant="table-row" rows={4} />
        ) : vaults.length === 0 ? (
          <EmptyState
            title="No service vaults yet"
            message="Open a service and create a vault to start adding credentials."
            action={<Link to="/app/projects">Browse projects and services</Link>}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={vaults}
            getRowKey={(vault) => vault.id}
            onRowClick={(vault) => navigate(`/app/vaults/${vault.id}`)}
            caption="Service vaults"
            emptyState={<EmptyState title="No service vaults" />}
          />
        )}
      </div>
    </div>
  )
}
