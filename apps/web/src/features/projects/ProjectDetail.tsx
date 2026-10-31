import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Topbar from '../../components/ui/Topbar'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'

interface Project { id: string; name: string; description: string | null; created_at: string }

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    const ctrl = new AbortController()
    apiGet<{ data: Project }>(`/api/v1/projects/${projectId}`, { signal: ctrl.signal })
      .then((r) => setProject(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [projectId])

  if (loading) return <SkeletonLoader variant="detail-panel" />
  if (!project) return <EmptyState title="Project not found" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar breadcrumbs={[{ label: 'Projects', href: '/app/projects' }, { label: project.name, href: `/app/projects/${project.id}` }]} />
      <div style={{ padding: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>{project.name}</h1>
        {project.description && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{project.description}</p>}
      </div>
    </div>
  )
}
