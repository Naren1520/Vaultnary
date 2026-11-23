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
  const [enableTimedDestruction, setEnableTimedDestruction] = useState(false)
  const [destroyAt, setDestroyAt] = useState('')
  const [showCreateVault, setShowCreateVault] = useState(false)

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
        {
          name,
          destroy_at: enableTimedDestruction && destroyAt
            ? new Date(destroyAt).toISOString()
            : undefined,
        },
      )
      setVaults((current) => [...current, response.data])
      setVaultName('')
      setDestroyAt('')
      setEnableTimedDestruction(false)
      setShowCreateVault(false)
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Could not create the vault.')
    } finally {
      setCreating(false)
    }
  }

  function renderVaultCard() {
    return (
      <button
        type="button"
        className="service-create-vault-card service-create-vault-card--compact"
        onClick={() => {
          setCreateError('')
          setShowCreateVault(true)
        }}
      >
        <span className="service-create-vault-card__icon" aria-hidden="true">
          <Plus size={20} />
        </span>
        <span className="service-create-vault-card__intro">
          <strong>Create vault</strong>
          <span>Add another credential vault</span>
        </span>
      </button>
    )
  }

  function renderCreateVaultModal() {
    if (!showCreateVault) return null

    return (
      <div
        role="presentation"
        className="app-modal-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCreateVault(false)
        }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.42)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 200,
          padding: 'var(--space-8) var(--space-4)',
          overflowY: 'auto',
        }}
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-vault-title"
          onSubmit={handleCreateVault}
          className="app-modal-panel service-create-vault-modal"
          style={{
            width: '100%',
            maxWidth: '32rem',
            padding: 'var(--space-6)',
            border: 'var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowCreateVault(false)}
            className="service-create-vault-modal__close"
          >
            ×
          </button>
          <div className="service-create-vault-modal__heading">
            <span className="service-create-vault-card__icon" aria-hidden="true">
              <Plus size={20} />
            </span>
            <div>
              <h2 id="create-vault-title">Create another vault</h2>
              <p>Keep this set of credentials separate.</p>
            </div>
          </div>

          <label htmlFor="service-vault-name">Vault name</label>
          <input
            id="service-vault-name"
            name="name"
            type="text"
            maxLength={100}
            value={vaultName}
            onChange={(event) => setVaultName(event.target.value)}
            placeholder="e.g. Production credentials"
            autoFocus
            required
            disabled={creating}
          />

          <label className="service-create-vault-modal__checkbox">
            <input
              type="checkbox"
              checked={enableTimedDestruction}
              onChange={(event) => setEnableTimedDestruction(event.target.checked)}
              disabled={creating}
            />
            <span>
              <strong>Automatically destroy this vault</strong>
              <small>Choose a date and time in the schedule</small>
            </span>
          </label>

          {enableTimedDestruction && (
            <div className="service-create-vault-modal__destruction">
              <label htmlFor="service-vault-destroy-at">Destruction date and time</label>
              <input
                id="service-vault-destroy-at"
                type="datetime-local"
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                value={destroyAt}
                onChange={(event) => setDestroyAt(event.target.value)}
                required
                disabled={creating}
              />
              <small>Only this vault will be deleted. You can cancel it before the scheduled time.</small>
            </div>
          )}

          {createError && (
            <p className="service-create-vault-modal__error" role="alert">{createError}</p>
          )}

          <div className="service-create-vault-modal__actions">
            <button
              type="button"
              className="app-secondary-action"
              onClick={() => setShowCreateVault(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="app-primary-action"
              disabled={creating || !vaultName.trim() || (enableTimedDestruction && !destroyAt)}
            >
              <Plus size={16} aria-hidden="true" />
              {creating ? 'Creating…' : 'Create vault'}
            </button>
          </div>
        </form>
      </div>
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
                  {renderVaultCard()}
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
                    {renderVaultCard()}
                  </li>
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {renderCreateVaultModal()}
    </div>
  )
}
