import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, Plus, Server } from 'lucide-react'
import Topbar from '../../components/ui/Topbar'
import SkeletonLoader from '../../components/ui/SkeletonLoader'
import EmptyState from '../../components/feedback/EmptyState'
import { apiGet } from '../../services/http-client'

interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_at: string
}
interface Service { id: string; name: string; environment: string; project_id: string }

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    if (!projectId) {
      setError('Project ID is missing.')
      setLoading(false)
      return () => ctrl.abort()
    }
    Promise.all([
      apiGet<{ data: Project }>(`/api/v1/projects/${projectId}`, { signal: ctrl.signal }),
      apiGet<{ data: Service[] }>('/api/v1/services', { signal: ctrl.signal }),
    ])
      .then(([projectResponse, serviceResponse]) => {
        setProject(projectResponse.data)
        setServices(serviceResponse.data.filter((service) => service.project_id === projectId))
        setError('')
      })
      .catch((cause: unknown) => {
        if (!ctrl.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load project details.')
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [projectId, retryCount])

  if (loading) return <SkeletonLoader variant="detail-panel" />
  if (!project && !error) return <EmptyState title="Project not found" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Topbar
        breadcrumbs={[
          { label: 'Workspaces', href: '/app/workspaces' },
          ...(project
            ? [{
              label: 'Projects',
              href: `/app/workspaces/${project.workspace_id}/projects`,
            }]
            : []),
          {
            label: project?.name ?? 'Project',
            href: project ? `/app/projects/${project.id}` : '/app/workspaces',
          },
        ]}
        showSearch={false}
      />
      <div style={{ padding: 'var(--space-4)' }}>
        {error ? (
          <div role="alert" style={{ color: 'var(--color-danger)' }}>
            <p>{error}</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
              Retry
            </button>
          </div>
        ) : project && (
          <>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>{project.name}</h1>
            {project.description && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{project.description}</p>}
            <section aria-labelledby="project-services-heading" style={{ marginTop: 'var(--space-6)' }}>
              <div className="app-page-heading">
                <div className="project-services-heading-row">
                  <div>
                    <h2 id="project-services-heading">Services</h2>
                    <p>Services in this project can each contain multiple vaults.</p>
                  </div>
                  {services.length > 0 && (
                    <Link
                      to={`/app/services?project_id=${project.id}`}
                      className="app-primary-action"
                    >
                      <Plus size={16} aria-hidden="true" />
                      Create service
                    </Link>
                  )}
                </div>
              </div>
              {services.length === 0 ? (
                <EmptyState
                  title="No services in this project"
                  message="Create a service here, then add its vaults and credentials."
                  action={
                    <Link
                      to={`/app/services?project_id=${project.id}`}
                      className="app-primary-action"
                    >
                      <Plus size={16} aria-hidden="true" />
                      Create service
                    </Link>
                  }
                />
              ) : (
                <ul className="service-vault-list">
                  {services.map((service) => (
                    <li key={service.id}>
                      <Link to={`/app/services/${service.id}`} className="project-service-card">
                        <span className="project-service-card__icon" aria-hidden="true">
                          <Server size={19} />
                        </span>
                        <span className="project-service-card__body">
                          <strong>{service.name}</strong>
                          <span className="project-service-card__environment">
                            {service.environment}
                          </span>
                        </span>
                        <ArrowUpRight
                          className="project-service-card__arrow"
                          size={17}
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
