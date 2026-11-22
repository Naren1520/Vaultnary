import { useEffect, useState, type FormEvent } from 'react'
import { ChevronRight, FolderKey, Plus, Server } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../../components/feedback/EmptyState'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import Topbar from '../../components/ui/Topbar'
import { apiGet, apiPost } from '../../services/http-client'

interface Service {
  id: string
  name: string
  environment: string
  description: string | null
  project_id: string
}

interface ServiceVault {
  id: string
  name: string
  created_at: string
}

export default function ServiceDetail() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const [service, setService] = useState<Service | null>(null)
  const [vaults, setVaults] = useState<ServiceVault[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [createError, setCreateError] = useState('')
  const [vaultName, setVaultName] = useState('')
  const [creating, setCreating] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    if (!serviceId) {
      setLoadError('Service ID is missing.')
      setLoading(false)
      return () => controller.abort()
    }

    Promise.all([
      apiGet<{ data: Service }>(`/api/v1/services/${serviceId}`, { signal: controller.signal }),
      apiGet<{ data: ServiceVault[] }>(`/api/v1/services/${serviceId}/vaults`, {
        signal: controller.signal,
      }),
    ])
      .then(([serviceResponse, vaultResponse]) => {
        setService(serviceResponse.data)
        setVaults(vaultResponse.data)
        setLoadError('')
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : 'Could not load service details.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [serviceId, retryCount])

  async function handleCreateVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!serviceId || !service) {
      setCreateError('Service details must be loaded before creating a vault.')
      return
    }
    const name = vaultName.trim()
    if (!name) {
      setCreateError('Enter a name for the vault.')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const response = await apiPost<{ data: ServiceVault }>(
        `/api/v1/services/${serviceId}/vaults`,
        { name },
      )
      setVaults((current) => [...current, response.data])
      setVaultName('')
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Could not create the vault.')
    } finally {
      setCreating(false)
    }
  }

  function renderVaultForm(variant: 'empty' | 'card') {
    return (
      <form
        onSubmit={handleCreateVault}
        className={variant === 'empty'
          ? 'service-create-vault-form service-create-vault-form--empty'
          : 'service-create-vault-card'}
      >
        {variant === 'empty' && (
          <div className="service-create-vault-form__intro">
            <strong>Create your first vault</strong>
            <span>Choose a name to get started.</span>
          </div>
        )}
        {variant === 'card' && (
          <>
            <span className="service-create-vault-card__icon" aria-hidden="true">
              <Plus size={19} />
            </span>
            <div className="service-create-vault-card__intro">
              <p>Create another vault</p>
              <span>Keep another set of credentials separate.</span>
            </div>
          </>
        )}
        <label htmlFor="service-vault-name">Vault name</label>
        <input
          id="service-vault-name"
          name="name"
          type="text"
          maxLength={100}
          value={vaultName}
          onChange={(event) => setVaultName(event.target.value)}
          placeholder="e.g. Production credentials"
          required
          disabled={creating}
        />
        {createError && (
          <p className="service-create-vault-card__error" role="alert">{createError}</p>
        )}
        <button
          type="submit"
          className="app-primary-action"
          disabled={creating || !vaultName.trim()}
        >
          <Plus size={16} aria-hidden="true" />
          {creating ? 'Creating…' : 'Create vault'}
        </button>
      </form>
    )
  }

  if (loading) return <SkeletonLoader variant="detail-panel" />
  if (!service && !loadError) return <EmptyState title="Service not found" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar
        breadcrumbs={[
          { label: 'Workspaces', href: '/app/workspaces' },
          ...(service
            ? [{ label: 'Project', href: `/app/projects/${service.project_id}` }]
            : []),
          { label: service?.name ?? 'Service', href: `/app/services/${serviceId}` },
        ]}
        showSearch={false}
      />
      <div className="app-page-content service-detail-page" style={{ flex: 1, overflowY: 'auto' }}>
        {loadError && (
          <div role="alert" className="service-load-error">
            <p>{loadError}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Retry
            </button>
          </div>
        )}
        {service && (
          <>
            <header className="service-overview">
              <span className="service-overview__icon" aria-hidden="true">
                <Server size={23} />
              </span>
              <div className="service-overview__copy">
                <p className="app-page-heading__eyebrow">Service overview</p>
                <h1>{service.name}</h1>
                <p>{service.description || 'Manage this service’s vaults and credentials here.'}</p>
              </div>
              <div className="service-overview__environment">
                <span>Environment</span>
                <strong>{service.environment}</strong>
              </div>
            </header>

            <section className="service-vault-section" aria-labelledby="service-vaults-heading">
              <div className="service-vault-section__heading">
                <div>
                  <h2 id="service-vaults-heading">Vaults</h2>
                  <p>Encrypted credential storage for this service.</p>
                </div>
                <span className="service-vault-section__count">
                  {vaults.length} {vaults.length === 1 ? 'vault' : 'vaults'}
                </span>
              </div>
              {vaults.length === 0 ? (
                <div className="service-vault-empty-state">
                  <div className="service-vault-empty-state__message">
                    <span className="service-vault-empty-state__icon" aria-hidden="true">
                      <FolderKey size={22} />
                    </span>
                    <div>
                      <h3>No vaults yet</h3>
                      <p>
                        Create your first vault to securely organize credentials for {service.name}.
                      </p>
                    </div>
                  </div>
                  {renderVaultForm('empty')}
                </div>
              ) : (
                <ul className="service-vault-card-grid">
                  {vaults.map((vault) => (
                    <li key={vault.id}>
                      <Link to={`/app/vaults/${vault.id}`} className="service-vault-card">
                        <span className="service-vault-card__icon" aria-hidden="true">
                          <FolderKey size={20} />
                        </span>
                        <span className="service-vault-card__body">
                          <strong>{vault.name}</strong>
                          <span>{service.environment} credentials</span>
                        </span>
                        <ChevronRight className="service-vault-card__arrow" size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                  <li className="service-vault-create-slot">
                    {renderVaultForm('card')}
                  </li>
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
