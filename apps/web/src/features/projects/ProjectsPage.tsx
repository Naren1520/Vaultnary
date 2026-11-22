import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, FolderOpen } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { apiGet, apiPost } from '../../services/http-client'

interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_at: string
}

interface Workspace {
  id: string
  name: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
}

export default function ProjectsPage() {
  const { workspaceId: routeWorkspaceId } = useParams<{ workspaceId: string }>()
  const { showToast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const editableWorkspaces = useMemo(
    () => workspaces.filter(({ role }) => role !== 'viewer'),
    [workspaces],
  )
  const selectedWorkspace = workspaces.find(({ id }) => id === (routeWorkspaceId || workspaceId))
  const canCreateProject = routeWorkspaceId
    ? selectedWorkspace !== undefined && selectedWorkspace.role !== 'viewer'
    : editableWorkspaces.some(({ id }) => id === workspaceId)
  const visibleProjects = routeWorkspaceId
    ? projects.filter((project) => project.workspace_id === routeWorkspaceId)
    : projects

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      apiGet<{ data: Project[] }>('/api/v1/projects', { signal: ctrl.signal }),
      apiGet<{ data: Workspace[] }>('/api/v1/workspaces', { signal: ctrl.signal }),
    ])
      .then(([projectResponse, workspaceResponse]) => {
        setProjects(projectResponse.data)
        setWorkspaces(workspaceResponse.data)
        if (routeWorkspaceId) {
          setWorkspaceId(routeWorkspaceId)
          setError(workspaceResponse.data.some(({ id }) => id === routeWorkspaceId)
            ? ''
            : 'Workspace not found or you do not have access.')
        } else {
          setWorkspaceId((current) =>
            current && workspaceResponse.data.some(({ id }) => id === current)
              ? current
              : workspaceResponse.data.find(({ role }) => role !== 'viewer')?.id ?? '',
          )
        }
      })
      .catch((cause: unknown) => {
        if (!ctrl.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load projects.')
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [routeWorkspaceId, retryCount])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !workspaceId) {
      setError(!trimmedName ? 'Enter a project name.' : 'Choose a workspace where you can edit.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await apiPost<{ data: Project }>('/api/v1/projects', {
        name: trimmedName,
        description: description.trim() || null,
        workspace_id: workspaceId,
      })
      setProjects((current) => [response.data, ...current])
      setName('')
      setDescription('')
      showToast({ message: 'Project created', type: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create project.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-route-page">
      <Topbar
        breadcrumbs={[
          {
            label: selectedWorkspace?.name ?? 'Workspaces',
            href: '/app/workspaces',
          },
          { label: 'Projects', href: routeWorkspaceId ? `/app/workspaces/${routeWorkspaceId}/projects` : '/app/projects' },
        ]}
        showSearch={false}
      />
      <main className="app-page-content">
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">{selectedWorkspace?.name ?? 'Organize'}</p>
          <h1>Projects</h1>
          <p>Projects organize the services and vaults within this workspace.</p>
        </header>
        <form
          onSubmit={handleCreate}
          aria-label="Create project"
          className="app-create-form"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}
        >
          <label htmlFor="project-name" style={visuallyHiddenStyle}>Project name</label>
          <input
            id="project-name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
            style={inputStyle}
          />
          <label htmlFor="project-description" style={visuallyHiddenStyle}>Project description</label>
          <input
            id="project-description"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description (optional)"
            style={inputStyle}
          />
          {!routeWorkspaceId && (
            <>
              <label htmlFor="project-workspace" style={visuallyHiddenStyle}>Workspace</label>
              <select
                id="project-workspace"
                required
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                disabled={editableWorkspaces.length === 0}
                style={inputStyle}
              >
                {editableWorkspaces.length === 0 && <option value="">Create a workspace first</option>}
                {editableWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
            </>
          )}
          <button
            type="submit"
            disabled={saving || loading || !canCreateProject}
            style={buttonStyle}
          >
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </form>
        {error && (
          <div className="app-request-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <SkeletonLoader variant="table-row" rows={5} />
        ) : visibleProjects.length === 0 && !error ? (
          <section className="resource-empty-panel">
            <EmptyState
              title="No projects in this workspace yet"
              message="Create a project to organize its services and vaults."
              icon={<FolderOpen size={32} />}
            />
          </section>
        ) : (
          <ul className="resource-card-grid">
            {visibleProjects.map((project) => (
              <li key={project.id}>
                <Link className="resource-card" to={`/app/projects/${project.id}`}>
                  <span className="resource-card__icon">
                    <FolderOpen size={20} aria-hidden="true" />
                  </span>
                  <span className="resource-card__body">
                    <strong>{project.name}</strong>
                    <span>{project.description || `Created ${new Date(project.created_at).toLocaleDateString()}`}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

const inputStyle = {
  flex: '1 1 11rem',
  minWidth: 0,
  padding: 'var(--space-2) var(--space-3)',
  border: 'var(--border-input)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)',
}

const buttonStyle = {
  border: 'var(--border-card)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--color-bg-subtle)',
  color: 'var(--color-text)',
  cursor: 'pointer',
}

const visuallyHiddenStyle = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap' as const,
  border: 0,
}
