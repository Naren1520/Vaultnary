import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, GitBranch, Layers3, LockKeyhole } from 'lucide-react'
import EmptyState from '../../components/feedback/EmptyState'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import Topbar from '../../components/ui/Topbar'
import { apiGet } from '../../services/http-client'
import VaultTree from './VaultTree'

interface Vault {
  id: string
  workspace_name: string
  project_name: string
  service_name: string
  name: string
}

export default function HierarchyPage() {
  const { vaultId } = useParams<{ vaultId: string }>()
  const [vaults, setVaults] = useState<Vault[]>([])
  const [loading, setLoading] = useState(!vaultId)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (vaultId) return
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
  }, [retryCount, vaultId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar
        breadcrumbs={[
          { label: 'Vaults', href: '/app/vault' },
          { label: 'Hierarchy', href: vaultId ? `/app/hierarchy/${vaultId}` : '/app/hierarchy' },
        ]}
      />
      <div className="app-page-content hierarchy-page" style={{ flex: 1, overflowY: 'auto' }}>
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">Inside your service vaults</p>
          <h1>{vaultId ? 'Credential relationships' : 'Organize related credentials'}</h1>
          <p>
            {vaultId
              ? 'Browse credentials in this vault and open one to see its details.'
              : 'Credential hierarchy is an optional parent-child view for related credentials within a service vault.'}
          </p>
        </header>
        {vaultId ? (
          <section className="hierarchy-selected-vault">
            <div className="hierarchy-selected-vault__heading">
              <div>
                <span className="hierarchy-selected-vault__icon" aria-hidden="true">
                  <GitBranch size={18} />
                </span>
                <div>
                  <h2>Credential map</h2>
                  <p>Parent and child links show how credentials relate to one another.</p>
                </div>
              </div>
              <Link to="/app/hierarchy" className="app-secondary-action">
                Change vault
              </Link>
            </div>
            <VaultTree vaultId={vaultId} />
          </section>
        ) : error ? (
          <div role="alert" style={{ color: 'var(--color-danger)' }}>
            <p>{error}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <SkeletonLoader variant="table-row" rows={4} />
        ) : vaults.length === 0 ? (
          <EmptyState
            title="No vaults to organize yet"
            message="Create a service vault first. You can then browse its credentials here."
            action={<Link to="/app/projects">Browse projects and services</Link>}
          />
        ) : (
          <>
            <section className="hierarchy-intro-card">
              <span className="hierarchy-intro-card__icon" aria-hidden="true"><Layers3 size={20} /></span>
              <div>
                <h2>What is a credential hierarchy?</h2>
                <p>
                  It is an optional way to connect related credentials inside a vault. It does
                  not change your workspace, project, or service structure.
                </p>
              </div>
            </section>
            <section className="hierarchy-vault-section" aria-labelledby="hierarchy-vault-heading">
              <div className="resource-section-heading">
                <div>
                  <h2 id="hierarchy-vault-heading">Choose a service vault</h2>
                  <p>Select the vault whose credentials you want to browse.</p>
                </div>
                <span>{vaults.length} {vaults.length === 1 ? 'vault' : 'vaults'}</span>
              </div>
              <ul className="hierarchy-vault-list">
                {vaults.map((vault) => (
                  <li key={vault.id}>
                    <Link to={`/app/hierarchy/${vault.id}`} className="hierarchy-vault-card">
                      <span className="hierarchy-vault-card__icon" aria-hidden="true">
                        <LockKeyhole size={18} />
                      </span>
                      <span className="hierarchy-vault-card__body">
                        <strong>{vault.name}</strong>
                        <span>{vault.service_name}</span>
                        <small>{vault.workspace_name} <b>/</b> {vault.project_name}</small>
                      </span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
