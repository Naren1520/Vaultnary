import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import DataTable, { Column } from '../../components/ui/DataTable'
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
  project_id: string | null
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

const columns: Column<Service>[] = [
  { key: 'name', header: 'Name', sortable: true, render: (r) => <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{r.name}</span> },
  { key: 'environment', header: 'Environment', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{r.environment}</span>, width: '8rem' },
  { key: 'description', header: 'Description', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{r.description ?? '—'}</span> },
]

export default function ServicesPage() {
  const navigate = useNavigate()
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
        setWorkspaceId((current) =>
          current && workspaceResponse.data.some(({ id }) => id === current)
            ? current
            : workspaceResponse.data.find(({ role }) => role !== 'viewer')?.id ?? '',
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
  }, [])

  useEffect(() => {
    if (projectId && !workspaceProjects.some((project) => project.id === projectId)) {
      setProjectId('')
    }
  }, [projectId, workspaceProjects])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !workspaceId) {
      setError(!trimmedName ? 'Enter a service name.' : 'Choose a workspace where you can edit.')
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
        project_id: projectId || null,
      })
      setServices((current) => [response.data, ...current])
      setName('')
      setDescription('')
      setProjectId('')
      showToast({ message: 'Service created', type: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create service.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Services', href: '/app/services' }]} />
      <div style={{ padding: 'var(--space-4)', flex: 1 }}>
        <form
          onSubmit={handleCreate}
          aria-label="Create service"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}
        >
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
          <label htmlFor="service-workspace" style={visuallyHiddenStyle}>Workspace</label>
          <select
            id="service-workspace"
            required
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            disabled={editableWorkspaces.length === 0}
            style={inputStyle}
          >
            {editableWorkspaces.length === 0 && <option value="">No editable workspace</option>}
            {editableWorkspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
          <label htmlFor="service-project" style={visuallyHiddenStyle}>Project (optional)</label>
          <select
            id="service-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            style={inputStyle}
          >
            <option value="">No project</option>
            {workspaceProjects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <button type="submit" disabled={saving || loading || editableWorkspaces.length === 0} style={buttonStyle}>
            {saving ? 'Creating…' : 'Create service'}
          </button>
        </form>
        {error && <p role="alert" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>{error}</p>}
        {loading
          ? <SkeletonLoader variant="table-row" rows={5} />
          : <DataTable columns={columns} rows={services} getRowKey={(r) => r.id} onRowClick={(r) => navigate(`/app/services/${r.id}`)} caption="Services" emptyState={<EmptyState title="No services" message="Create a service to link credentials to environments." />} />}
      </div>
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
