import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import DataTable, { Column } from '../../components/ui/DataTable'
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

const columns: Column<Project>[] = [
  { key: 'name', header: 'Name', sortable: true, render: (r) => <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{r.name}</span> },
  { key: 'description', header: 'Description', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{r.description ?? '-'}</span> },
  { key: 'created_at', header: 'Created', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{new Date(r.created_at).toLocaleDateString()}</span>, width: '9rem' },
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editableWorkspaces = useMemo(
    () => workspaces.filter(({ role }) => role !== 'viewer'),
    [workspaces],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all([
      apiGet<{ data: Project[] }>('/api/v1/projects', { signal: ctrl.signal }),
      apiGet<{ data: Workspace[] }>('/api/v1/workspaces', { signal: ctrl.signal }),
    ])
      .then(([projectResponse, workspaceResponse]) => {
        setProjects(projectResponse.data)
        setWorkspaces(workspaceResponse.data)
        setWorkspaceId((current) =>
          current && workspaceResponse.data.some(({ id }) => id === current)
            ? current
            : workspaceResponse.data.find(({ role }) => role !== 'viewer')?.id ?? '',
        )
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
  }, [])

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Projects', href: '/app/projects' }]} />
      <div className="app-page-content" style={{ padding: 'var(--space-4)', overflowY: 'auto', flex: 1 }}>
        <header className="app-page-heading">
          <p className="app-page-heading__eyebrow">Organize</p>
          <h1>Projects</h1>
          <p>Group related services and credentials into clear, manageable spaces.</p>
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
          <label htmlFor="project-workspace" style={visuallyHiddenStyle}>Workspace</label>
          <select
            id="project-workspace"
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
          <button type="submit" disabled={saving || loading || editableWorkspaces.length === 0} style={buttonStyle}>
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </form>
        {error && <p role="alert" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>{error}</p>}
        {loading
          ? <SkeletonLoader variant="table-row" rows={5} />
          : <DataTable columns={columns} rows={projects} getRowKey={(r) => r.id} onRowClick={(r) => navigate(`/app/projects/${r.id}`)} caption="Projects" emptyState={<EmptyState title="No projects" message="Create a project to start linking credentials." />} />}
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
