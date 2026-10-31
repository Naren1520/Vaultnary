import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import DataTable, { Column } from '../../components/ui/DataTable'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

const columns: Column<Project>[] = [
  { key: 'name', header: 'Name', sortable: true, render: (r) => <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{r.name}</span> },
  { key: 'description', header: 'Description', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{r.description ?? '—'}</span> },
  { key: 'created_at', header: 'Created', render: (r) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{new Date(r.created_at).toLocaleDateString()}</span>, width: '9rem' },
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    apiGet<{ data: Project[] }>('/api/v1/projects', { signal: ctrl.signal })
      .then((r) => setProjects(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Projects', href: '/app/projects' }]} />
      <div style={{ padding: 'var(--space-4)', overflowY: 'auto', flex: 1 }}>
        {loading
          ? <SkeletonLoader variant="table-row" rows={5} />
          : <DataTable columns={columns} rows={projects} getRowKey={(r) => r.id} onRowClick={(r) => navigate(`/app/projects/${r.id}`)} caption="Projects" emptyState={<EmptyState title="No projects" message="Create a project to start linking credentials." />} />}
      </div>
    </div>
  )
}
