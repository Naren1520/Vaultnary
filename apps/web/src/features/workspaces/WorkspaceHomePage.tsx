import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Building2, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import EmptyState from '../../components/feedback/EmptyState'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import Topbar from '../../components/ui/Topbar'
import { apiGet, apiPost } from '../../services/http-client'

interface Workspace {
  id: string
  name: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  created_at: string
}

export default function WorkspaceHomePage() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceName, setWorkspaceName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    apiGet<{ data: Workspace[] }>('/api/v1/workspaces', { signal: controller.signal })
      .then((response) => {
        setWorkspaces(response.data)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load workspaces.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [retryCount])

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = workspaceName.trim()
    if (!name) {
      setError('Enter a workspace name.')
      return
    }

    setCreating(true)
    setError('')
    try {
      const response = await apiPost<{ data: Workspace }>('/api/v1/workspaces', { name })
      navigate(`/app/workspaces/${response.data.id}/projects`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create workspace.')
    } finally {
      setCreating(false)
    }
  }

  const createForm = (
    <form onSubmit={handleCreateWorkspace} className="resource-create-form">
      <label className="visually-hidden" htmlFor="new-workspace-name">
        Workspace name
      </label>
      <input
        id="new-workspace-name"
        value={workspaceName}
        onChange={(event) => setWorkspaceName(event.target.value)}
        maxLength={100}
        placeholder="Workspace name"
        required
        disabled={creating}
      />
      <button type="submit" disabled={creating || !workspaceName.trim()}>
        <Plus size={16} aria-hidden="true" />
        {creating ? 'Creating…' : 'Create workspace'}
      </button>
    </form>
  )

  return (
    <div className="app-route-page">
      <Topbar
        breadcrumbs={[{ label: 'Workspace', href: '/app/workspaces' }]}
        showSearch={false}
        actionsSlot={
          <Link className="app-secondary-action" to="/app/workspaces/manage">
            Manage workspaces
          </Link>
        }
      />
      <main className="app-page-content">
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">Your organization</p>
          <h1>Workspaces</h1>
          <p>Choose a workspace to browse its projects, services, and vaults.</p>
        </header>

        {error && (
          <div className="app-request-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonLoader variant="table-row" rows={3} />
        ) : workspaces.length === 0 && !error ? (
          <section className="resource-empty-panel">
            <EmptyState
              title="Create your first workspace"
              message="A workspace is the home for your projects, services, vaults, and credentials."
              icon={<Building2 size={32} />}
              action={createForm}
            />
          </section>
        ) : workspaces.length > 0 ? (
          <>
            <div className="resource-section-heading">
              <h2>Your workspaces</h2>
              <button
                type="button"
                className="app-secondary-action"
                onClick={() => setShowCreateForm((shown) => !shown)}
              >
                <Plus size={16} aria-hidden="true" />
                New workspace
              </button>
            </div>
            {showCreateForm && createForm}
            <ul className="resource-card-grid">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <Link
                    className="resource-card"
                    to={`/app/workspaces/${workspace.id}/projects`}
                  >
                    <span className="resource-card__icon">
                      <Building2 size={20} aria-hidden="true" />
                    </span>
                    <span className="resource-card__body">
                      <strong>{workspace.name}</strong>
                      <span>{workspace.role} · Created {new Date(workspace.created_at).toLocaleDateString()}</span>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
    </div>
  )
}
