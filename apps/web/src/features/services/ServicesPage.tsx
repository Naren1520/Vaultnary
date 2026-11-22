import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Server } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { apiGet, apiPost } from '../../services/http-client'

interface Service {
  id: string
  workspace_id: string
  name: string
  environment: string
  description: string | null
  project_id: string
  created_at: string
}

interface Workspace {
  id: string
  name: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
}

interface Project {
  id: string
  workspace_id: string
  name: string
}

const environments = ['development', 'staging', 'production', 'custom'] as const

export default function ServicesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedProjectId = searchParams.get('project_id')
  const { showToast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [environment, setEnvironment] = useState<(typeof environments)[number]>('development')
  const [workspaceId, setWorkspaceId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editableWorkspaces = useMemo(
    () => workspaces.filter(({ role }) => role !== 'viewer'),
    [workspaces],
  )
  const workspaceProjects = useMemo(
    () => projects.filter((project) => project.workspace_id === workspaceId),
    [projects, workspaceId],
  )
  const requestedProject = projects.find((project) => project.id === requestedProjectId)
  const requestedWorkspace = workspaces.find(
    (workspace) => workspace.id === requestedProject?.workspace_id,
  )
  const visibleServices = requestedProjectId
    ? services.filter((service) => service.project_id === requestedProjectId)
    : services
  const canCreate = requestedProjectId
    ? Boolean(requestedProject && editableWorkspaces.some(
      (workspace) => workspace.id === requestedProject.workspace_id,
    ))
    : false

  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all([
      apiGet<{ data: Service[] }>('/api/v1/services', { signal: ctrl.signal }),
      apiGet<{ data: Workspace[] }>('/api/v1/workspaces', { signal: ctrl.signal }),
      apiGet<{ data: Project[] }>('/api/v1/projects', { signal: ctrl.signal }),
    ])
      .then(([serviceResponse, workspaceResponse, projectResponse]) => {
        setServices(serviceResponse.data)
        setWorkspaces(workspaceResponse.data)
        setProjects(projectResponse.data)
        const requestedProject = projectResponse.data.find(
          (project) => project.id === requestedProjectId,
        )
        const editableRequestedProject =
          requestedProject && workspaceResponse.data.some(
            (workspace) => workspace.id === requestedProject.workspace_id && workspace.role !== 'viewer',
          )
            ? requestedProject
            : undefined
        setWorkspaceId((current) =>
          current && workspaceResponse.data.some(({ id }) => id === current)
            ? current
            : editableRequestedProject
              ? editableRequestedProject.workspace_id
              : workspaceResponse.data.find(({ role }) => role !== 'viewer')?.id ?? '',
        )
        setProjectId((current) =>
          current && projectResponse.data.some(({ id }) => id === current)
            ? current
            : editableRequestedProject
              ? editableRequestedProject.id
              : '',
        )
      })
      .catch((cause: unknown) => {
        if (!ctrl.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load services.')
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [requestedProjectId])

  useEffect(() => {
    if (!requestedProjectId && !workspaceProjects.some((project) => project.id === projectId)) {
      setProjectId(workspaceProjects[0]?.id ?? '')
    }
  }, [projectId, requestedProjectId, workspaceProjects])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !workspaceId || !projectId) {
      setError(
        !trimmedName
          ? 'Enter a service name.'
          : 'The project context is missing. Open this page from a project.',
      )
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await apiPost<{ data: Service }>('/api/v1/services', {
        name: trimmedName,
        description: description.trim() || null,
        environment,
        workspace_id: workspaceId,
        project_id: projectId,
      })
      showToast({ message: 'Service created', type: 'success' })
      navigate(`/app/services/${response.data.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create service.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-route-page">
      <Topbar
        breadcrumbs={[
          { label: 'Workspaces', href: '/app/workspaces' },
          ...(requestedProject
            ? [
              {
                label: requestedWorkspace?.name ?? 'Workspace',
                href: `/app/workspaces/${requestedProject.workspace_id}/projects`,
              },
              {
                label: requestedProject.name,
                href: `/app/projects/${requestedProject.id}`,
              },
            ]
            : []),
          { label: 'Services', href: requestedProjectId ? `/app/services?project_id=${requestedProjectId}` : '/app/services' },
        ]}
        showSearch={false}
      />
      <main className="app-page-content">
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">
            {requestedWorkspace?.name ?? 'Infrastructure'}
          </p>
          <h1>{requestedProject ? `Services for ${requestedProject.name}` : 'Services'}</h1>
          <p>
            {requestedProject
              ? 'Create services only inside this project, then add vaults to each service.'
              : 'Choose a project to view or create its services.'}
          </p>
        </header>

        {error && (
          <div className="app-request-error" role="alert">
            <p>{error}</p>
          </div>
        )}

        {requestedProject ? (
          <>
            {canCreate ? (
              <form
                onSubmit={handleCreate}
                aria-label="Create service"
                className="service-context-create"
              >
                <div className="service-context-create__context" aria-label="Selected hierarchy">
                  <span>Workspace</span>
                  <strong>{requestedWorkspace?.name ?? 'Unavailable'}</strong>
                  <span aria-hidden="true">/</span>
                  <span>Project</span>
                  <strong>{requestedProject.name}</strong>
                </div>
                <div className="service-context-create__fields">
                  <label htmlFor="service-name" style={visuallyHiddenStyle}>Service name</label>
                  <input
                    id="service-name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Service name"
                    style={inputStyle}
                  />
                  <label htmlFor="service-description" style={visuallyHiddenStyle}>Service description</label>
                  <input
                    id="service-description"
                    maxLength={500}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Description (optional)"
                    style={inputStyle}
                  />
                  <label htmlFor="service-environment" style={visuallyHiddenStyle}>Environment</label>
                  <select
                    id="service-environment"
                    value={environment}
                    onChange={(event) => setEnvironment(event.target.value as (typeof environments)[number])}
                    style={inputStyle}
                  >
                    {environments.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <button
                    type="submit"
                    disabled={saving || loading || !name.trim()}
                    className="app-primary-action"
                  >
                    {saving ? 'Creating…' : 'Create service'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="app-request-error" role="alert">
                You do not have permission to create services in this project.
              </div>
            )}
          </>
        ) : null}

        {loading ? (
          <SkeletonLoader variant="table-row" rows={5} />
        ) : visibleServices.length === 0 ? (
          !requestedProject ? (
            <section className="resource-empty-panel">
              <EmptyState
                title="Choose a project"
                message="Services belong to projects. Open a project first, then create its services."
                icon={<Server size={32} />}
                action={<Link to="/app/workspaces" className="app-primary-action">Browse workspaces</Link>}
              />
            </section>
          ) : (
            <section className="resource-empty-panel">
              <EmptyState
                title={`No services in ${requestedProject.name}`}
                message="Create the first service in this project using the form above."
                icon={<Server size={32} />}
              />
            </section>
          )
        ) : (
          <ul className="resource-card-grid" aria-label="Services">
            {visibleServices.map((service) => (
              <li key={service.id}>
                <Link className="resource-card" to={`/app/services/${service.id}`}>
                  <span className="resource-card__icon">
                    <Server size={20} aria-hidden="true" />
                  </span>
                  <span className="resource-card__body">
                    <strong>{service.name}</strong>
                    <span>{service.environment}{service.description ? ` · ${service.description}` : ''}</span>
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
